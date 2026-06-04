use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::{
    Json, Router,
    extract::{ConnectInfo, Path as AxumPath, State},
    http::{HeaderMap, StatusCode, header::USER_AGENT},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;
use tower_http::services::ServeDir;

use crate::{
    input::NoopInputSink,
    layout::{Layout, LayoutError, LayoutName, LayoutStore},
    stats::InputStats,
};

#[derive(Debug, Error)]
pub enum HttpError {
    #[error("layout failed: {0}")]
    Layout(#[from] LayoutError),
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    layout_dir: PathBuf,
    public_dir: PathBuf,
    default_layout_path: Option<PathBuf>,
    http_addr: Option<SocketAddr>,
    udp_addr: Option<SocketAddr>,
}

impl AppConfig {
    pub fn new(layout_dir: PathBuf, public_dir: PathBuf) -> Self {
        Self {
            layout_dir,
            public_dir,
            default_layout_path: None,
            http_addr: None,
            udp_addr: None,
        }
    }

    pub fn for_test(base: &Path) -> Self {
        Self {
            layout_dir: base.join("layouts"),
            public_dir: base.join("public"),
            default_layout_path: None,
            http_addr: None,
            udp_addr: None,
        }
    }

    pub fn with_default_layout_path(mut self, path: PathBuf) -> Self {
        self.default_layout_path = Some(path);
        self
    }

    pub fn with_server_addrs(mut self, http_addr: SocketAddr, udp_addr: SocketAddr) -> Self {
        self.http_addr = Some(http_addr);
        self.udp_addr = Some(udp_addr);
        self
    }
}

#[derive(Debug, Clone)]
struct AppState {
    layouts: LayoutStore,
    stats: Arc<InputStats>,
    server_info: ServerInfo,
}

#[derive(Debug, Clone)]
struct ServerInfo {
    http_addr: Option<SocketAddr>,
    udp_addr: Option<SocketAddr>,
    default_layout_path: Option<PathBuf>,
}

pub fn build_router(config: AppConfig, _sink: NoopInputSink) -> Result<Router, HttpError> {
    build_router_with_stats(config, Arc::new(InputStats::default()))
}

pub fn build_router_with_stats(
    config: AppConfig,
    stats: Arc<InputStats>,
) -> Result<Router, HttpError> {
    let layouts = match config.default_layout_path.clone() {
        Some(path) => LayoutStore::with_default_path(config.layout_dir, path),
        None => LayoutStore::new(config.layout_dir),
    };
    let state = AppState {
        layouts,
        stats,
        server_info: ServerInfo {
            http_addr: config.http_addr,
            udp_addr: config.udp_addr,
            default_layout_path: config.default_layout_path,
        },
    };
    Ok(Router::new()
        .route("/healthz", get(healthz))
        .route("/api/clients/connect", post(post_client_connect))
        .route("/api/layouts/{name}", get(get_layout).put(put_layout))
        .route("/api/stats", get(get_stats))
        .with_state(state)
        .fallback_service(ServeDir::new(config.public_dir)))
}

async fn healthz() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn post_client_connect(
    State(state): State<AppState>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(request): Json<ClientConnectRequest>,
) -> impl IntoResponse {
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    tracing::info!(
        remote = %remote,
        client = request.client.as_deref().unwrap_or("unknown"),
        app_version = request.app_version.as_deref().unwrap_or("unknown"),
        user_agent,
        http = state
            .server_info
            .http_addr
            .map(|addr| addr.to_string())
            .as_deref()
            .unwrap_or("unknown"),
        udp = state
            .server_info
            .udp_addr
            .map(|addr| addr.to_string())
            .as_deref()
            .unwrap_or("unknown"),
        "client connected"
    );
    Json(ClientConnectResponse {
        status: "connected",
        http_port: state.server_info.http_addr.map(|addr| addr.port()),
        udp_port: state.server_info.udp_addr.map(|addr| addr.port()),
        default_layout: state
            .server_info
            .default_layout_path
            .as_ref()
            .map(|path| path.display().to_string()),
    })
}

async fn get_layout(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
) -> Result<Response, ApiError> {
    let name = LayoutName::parse(&name)?;
    let layout = match state.layouts.load(&name) {
        Ok(layout) => layout,
        Err(LayoutError::Io(error))
            if name.is_default() && error.kind() == std::io::ErrorKind::NotFound =>
        {
            Layout::default_editor()
        }
        Err(error) => return Err(error.into()),
    };
    Ok((StatusCode::OK, layout.to_pretty_json()).into_response())
}

async fn put_layout(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
    body: String,
) -> Result<Response, ApiError> {
    let name = LayoutName::parse(&name)?;
    let layout = Layout::from_json(&body)?;
    state.layouts.save(&name, &layout)?;
    Ok((StatusCode::OK, Json(json!({ "status": "saved" }))).into_response())
}

async fn get_stats(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.stats.snapshot())
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientConnectRequest {
    client: Option<String>,
    app_version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientConnectResponse {
    status: &'static str,
    http_port: Option<u16>,
    udp_port: Option<u16>,
    default_layout: Option<String>,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl From<LayoutError> for ApiError {
    fn from(error: LayoutError) -> Self {
        let status = match error {
            LayoutError::Json(_) | LayoutError::InvalidName => StatusCode::UNPROCESSABLE_ENTITY,
            LayoutError::Io(_) | LayoutError::Persist(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        Self {
            status,
            message: error.to_string(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({
                "error": {
                    "message": self.message
                }
            })),
        )
            .into_response()
    }
}
