use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::{
    Json, Router,
    extract::{Path as AxumPath, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
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
}

impl AppConfig {
    pub fn new(layout_dir: PathBuf, public_dir: PathBuf) -> Self {
        Self {
            layout_dir,
            public_dir,
        }
    }

    pub fn for_test(base: &Path) -> Self {
        Self {
            layout_dir: base.join("layouts"),
            public_dir: base.join("public"),
        }
    }
}

#[derive(Debug, Clone)]
struct AppState {
    layouts: LayoutStore,
    stats: Arc<InputStats>,
}

pub fn build_router(config: AppConfig, _sink: NoopInputSink) -> Result<Router, HttpError> {
    build_router_with_stats(config, Arc::new(InputStats::default()))
}

pub fn build_router_with_stats(
    config: AppConfig,
    stats: Arc<InputStats>,
) -> Result<Router, HttpError> {
    let state = AppState {
        layouts: LayoutStore::new(config.layout_dir),
        stats,
    };
    Ok(Router::new()
        .route("/healthz", get(healthz))
        .route("/api/layouts/{name}", get(get_layout).put(put_layout))
        .route("/api/stats", get(get_stats))
        .with_state(state)
        .fallback_service(ServeDir::new(config.public_dir)))
}

async fn healthz() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
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
