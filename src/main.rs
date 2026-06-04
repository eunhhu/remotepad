use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use anyhow::Context;
use clap::{Parser, ValueEnum};
use remotepad::{
    http::{AppConfig, build_router_with_stats},
    input::{EnigoInputSink, NoopInputSink},
    layout::Layout,
    paths::resolve_existing_public_dir,
    stats::InputStats,
    udp::UdpInputServer,
};

#[derive(Debug, Parser)]
#[command(name = "remotepad", about = "Rust UDP remote input server")]
struct Args {
    #[arg(long)]
    port: Option<u16>,
    #[arg(long)]
    http_addr: Option<SocketAddr>,
    #[arg(long)]
    udp_addr: Option<SocketAddr>,
    #[arg(long, default_value = "layouts")]
    layout_dir: PathBuf,
    #[arg(long)]
    load: Option<PathBuf>,
    #[arg(long, default_value = "web/dist")]
    public_dir: PathBuf,
    #[arg(long, value_enum, default_value_t = Backend::Enigo)]
    backend: Backend,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Backend {
    Noop,
    Enigo,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "remotepad=info,tower_http=info".into()),
        )
        .init();

    let args = Args::parse();
    match args.backend {
        Backend::Noop => run(args, NoopInputSink::default()).await,
        Backend::Enigo => run(args, EnigoInputSink::new()?).await,
    }
}

async fn run<Sink>(args: Args, sink: Sink) -> anyhow::Result<()>
where
    Sink: remotepad::input::InputSink,
{
    if let Some(path) = &args.load {
        validate_loaded_layout(path)?;
    }

    let (http_addr, udp_addr) = listen_addrs(&args);
    let stats = Arc::new(InputStats::default());
    let public_dir = resolve_existing_public_dir(
        &args.public_dir,
        &std::env::current_exe().context("resolving current exe")?,
        &std::env::current_dir().context("resolving current dir")?,
    );
    let http_listener = tokio::net::TcpListener::bind(http_addr)
        .await
        .with_context(|| format!("binding http {}", http_addr))?;
    let udp_server = UdpInputServer::bind(udp_addr, sink, Arc::clone(&stats))
        .await
        .with_context(|| format!("binding udp {}", udp_addr))?;
    let http_local_addr = http_listener
        .local_addr()
        .context("reading http local address")?;
    let udp_local_addr = udp_server.local_addr();
    let mut config = AppConfig::new(args.layout_dir, public_dir.clone())
        .with_server_addrs(http_local_addr, udp_local_addr);
    if let Some(path) = args.load {
        config = config.with_default_layout_path(path);
    }
    let app = build_router_with_stats(config, Arc::clone(&stats))?;

    tracing::info!(
        http = %http_local_addr,
        udp = %udp_local_addr,
        backend = ?args.backend,
        public_dir = %public_dir.display(),
        layout = "default",
        "remotepad listening"
    );

    tokio::select! {
        http_result = axum::serve(http_listener, app.into_make_service_with_connect_info::<SocketAddr>()) => {
            http_result.context("http server failed")?;
        }
        udp_result = udp_server.run_forever() => {
            udp_result.context("udp input server failed")?;
        }
        signal_result = tokio::signal::ctrl_c() => {
            signal_result.context("installing ctrl-c handler")?;
            tracing::info!("shutdown requested");
        }
    }

    Ok(())
}

fn listen_addrs(args: &Args) -> (SocketAddr, SocketAddr) {
    let default_http_port = args.port.unwrap_or(3000);
    let default_udp_port = args.port.unwrap_or(3001);
    (
        args.http_addr
            .unwrap_or_else(|| SocketAddr::from(([0, 0, 0, 0], default_http_port))),
        args.udp_addr
            .unwrap_or_else(|| SocketAddr::from(([0, 0, 0, 0], default_udp_port))),
    )
}

fn validate_loaded_layout(path: &std::path::Path) -> anyhow::Result<()> {
    if !path.exists() {
        tracing::warn!(layout = %path.display(), "loaded layout file does not exist yet");
        return Ok(());
    }
    let body = std::fs::read_to_string(path)
        .with_context(|| format!("reading loaded layout {}", path.display()))?;
    Layout::from_json(&body)
        .with_context(|| format!("parsing loaded layout {}", path.display()))?;
    Ok(())
}
