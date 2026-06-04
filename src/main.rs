use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use anyhow::Context;
use clap::{Parser, ValueEnum};
use remotepad::{
    http::{AppConfig, build_router_with_stats},
    input::{EnigoInputSink, NoopInputSink},
    stats::InputStats,
    udp::UdpInputServer,
};

#[derive(Debug, Parser)]
#[command(name = "remotepad", about = "Rust UDP remote input server")]
struct Args {
    #[arg(long, default_value = "0.0.0.0:3000")]
    http_addr: SocketAddr,
    #[arg(long, default_value = "0.0.0.0:3001")]
    udp_addr: SocketAddr,
    #[arg(long, default_value = "layouts")]
    layout_dir: PathBuf,
    #[arg(long, default_value = "web/dist")]
    public_dir: PathBuf,
    #[arg(long, value_enum, default_value_t = Backend::Noop)]
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
    let stats = Arc::new(InputStats::default());
    let config = AppConfig::new(args.layout_dir, args.public_dir);
    let app = build_router_with_stats(config, Arc::clone(&stats))?;
    let http_listener = tokio::net::TcpListener::bind(args.http_addr)
        .await
        .with_context(|| format!("binding http {}", args.http_addr))?;
    let udp_server = UdpInputServer::bind(args.udp_addr, sink, Arc::clone(&stats))
        .await
        .with_context(|| format!("binding udp {}", args.udp_addr))?;

    tracing::info!(http = %args.http_addr, udp = %udp_server.local_addr(), "remotepad listening");

    tokio::select! {
        http_result = axum::serve(http_listener, app) => {
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
