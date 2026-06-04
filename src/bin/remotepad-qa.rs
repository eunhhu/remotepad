use std::net::SocketAddr;

use anyhow::{Context, bail};
use clap::Parser;
use remotepad::{
    keymap::{QA_KEY_FIXTURE, windows_scan_code_for_dom_code},
    protocol::{Frame, KeyCode},
};

#[derive(Debug, Parser)]
#[command(name = "remotepad-qa", about = "Send deterministic UDP input frames")]
struct Args {
    #[arg(long)]
    target: SocketAddr,
    #[arg(long)]
    bind: Option<SocketAddr>,
    #[arg(long, default_value_t = 1)]
    frames: u64,
    #[arg(long = "key", value_name = "DOM_CODE")]
    key_names: Vec<String>,
    #[arg(long)]
    keys: Option<u16>,
    #[arg(long)]
    state: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let bind_addr = args.bind.unwrap_or_else(|| {
        if args.target.is_ipv6() {
            "[::]:0".parse().expect("valid ipv6 bind")
        } else {
            "0.0.0.0:0".parse().expect("valid ipv4 bind")
        }
    });
    let socket = tokio::net::UdpSocket::bind(bind_addr)
        .await
        .context("binding qa udp socket")?;
    let local_addr = socket.local_addr().context("reading qa local address")?;
    let keys = selected_keys(&args)?;
    let mut sequence = 1_u64;
    let mut sent = 0_u64;

    for _ in 0..args.frames {
        if args.state {
            send_frame(
                &socket,
                args.target,
                Frame::state(sequence, sequence, &keys),
                sequence,
            )
            .await?;
            sequence += 1;
            sent += 1;
            send_frame(
                &socket,
                args.target,
                Frame::state(sequence, sequence, &[]),
                sequence,
            )
            .await?;
            sequence += 1;
            sent += 1;
        } else {
            for key in &keys {
                send_frame(
                    &socket,
                    args.target,
                    Frame::key_event(sequence, sequence, *key, true),
                    sequence,
                )
                .await?;
                sequence += 1;
                sent += 1;
            }
            for key in keys.iter().rev() {
                send_frame(
                    &socket,
                    args.target,
                    Frame::key_event(sequence, sequence, *key, false),
                    sequence,
                )
                .await?;
                sequence += 1;
                sent += 1;
            }
        }
    }

    println!(
        "sent {} udp datagrams from {} to {} with {} key(s)",
        sent,
        local_addr,
        args.target,
        keys.len()
    );
    Ok(())
}

async fn send_frame(
    socket: &tokio::net::UdpSocket,
    target: SocketAddr,
    frame: Frame,
    sequence: u64,
) -> anyhow::Result<()> {
    socket
        .send_to(&frame.encode(), target)
        .await
        .with_context(|| format!("sending frame {sequence} to {target}"))?;
    Ok(())
}

fn selected_keys(args: &Args) -> anyhow::Result<Vec<KeyCode>> {
    if !args.key_names.is_empty() {
        return args
            .key_names
            .iter()
            .map(|name| {
                windows_scan_code_for_dom_code(name)
                    .with_context(|| format!("unsupported key code {name:?}"))
            })
            .collect();
    }
    if let Some(count) = args.keys {
        return key_fixture(count);
    }
    windows_scan_code_for_dom_code("KeyZ")
        .context("default KeyZ mapping missing")
        .map(|key| vec![key])
}

fn key_fixture(count: u16) -> anyhow::Result<Vec<KeyCode>> {
    let count = usize::from(count);
    if count == 0 || count > QA_KEY_FIXTURE.len() {
        bail!("--keys must be between 1 and {}", QA_KEY_FIXTURE.len());
    }
    QA_KEY_FIXTURE
        .iter()
        .take(count)
        .map(|name| {
            windows_scan_code_for_dom_code(name)
                .with_context(|| format!("unsupported key fixture {name:?}"))
        })
        .collect()
}
