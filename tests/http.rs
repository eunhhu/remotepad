use axum::body::{Body, to_bytes};
use remotepad::{
    http::{AppConfig, build_router},
    input::NoopInputSink,
};
use std::fs;
use tower::ServiceExt;

#[tokio::test]
async fn healthz_returns_ok_when_server_ready() {
    let temp = tempfile::tempdir().expect("temp dir");
    let app = build_router(AppConfig::for_test(temp.path()), NoopInputSink::default())
        .expect("router builds");

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), axum::http::StatusCode::OK);
}

#[tokio::test]
async fn layout_api_saves_and_loads_valid_layout() {
    let temp = tempfile::tempdir().expect("temp dir");
    let app = build_router(AppConfig::for_test(temp.path()), NoopInputSink::default())
        .expect("router builds");
    let body = r#"{"canvasSize":{"width":"10px","height":"10px"},"controls":[]}"#;

    let response = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("PUT")
                .uri("/api/layouts/qa")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .expect("request"),
        )
        .await
        .expect("put response");
    assert_eq!(response.status(), axum::http::StatusCode::OK);

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/layouts/qa")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");
    assert_eq!(response.status(), axum::http::StatusCode::OK);

    let bytes = to_bytes(response.into_body(), 1_048_576)
        .await
        .expect("body bytes");
    let json = String::from_utf8(bytes.to_vec()).expect("utf8 json");
    assert!(json.contains("\"canvasSize\""));
}

#[tokio::test]
async fn layout_api_returns_default_editor_layout_when_default_file_is_missing() {
    let temp = tempfile::tempdir().expect("temp dir");
    let app = build_router(AppConfig::for_test(temp.path()), NoopInputSink::default())
        .expect("router builds");

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/layouts/default")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");
    assert_eq!(response.status(), axum::http::StatusCode::OK);

    let bytes = to_bytes(response.into_body(), 1_048_576)
        .await
        .expect("body bytes");
    let json = String::from_utf8(bytes.to_vec()).expect("utf8 json");
    assert!(json.contains("\"KeyZ\""));
}

#[tokio::test]
async fn layout_api_rejects_malformed_layout() {
    let temp = tempfile::tempdir().expect("temp dir");
    let app = build_router(AppConfig::for_test(temp.path()), NoopInputSink::default())
        .expect("router builds");

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .method("PUT")
                .uri("/api/layouts/bad")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"canvasSize":{}}"#))
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(
        response.status(),
        axum::http::StatusCode::UNPROCESSABLE_ENTITY
    );
}

#[tokio::test]
async fn static_fallback_uses_test_public_dir_when_configured_for_test() {
    let temp = tempfile::tempdir().expect("temp dir");
    let public_dir = temp.path().join("public");
    fs::create_dir_all(&public_dir).expect("public dir");
    fs::write(public_dir.join("index.html"), "qa index").expect("index write");
    let app = build_router(AppConfig::for_test(temp.path()), NoopInputSink::default())
        .expect("router builds");

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let bytes = to_bytes(response.into_body(), 1_048_576)
        .await
        .expect("body bytes");
    let body = String::from_utf8(bytes.to_vec()).expect("utf8");

    assert_eq!(body, "qa index");
}
