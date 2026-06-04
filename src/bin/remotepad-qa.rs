use std::net::SocketAddr;

use anyhow::Context;
use clap::Parser;
use remotepad::protocol::{Frame, KeyCode};

#[derive(Debug, Parser)]
#[command(name = "remotepad-qa", about = "Send deterministic UDP input frames")]
struct Args {
    #[arg(long)]
    target: SocketAddr,
    #[arg(long, default_value_t = 1)]
    frames: u64,
    #[arg(long, default_value_t = 12)]
    keys: u16,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let socket = tokio::net::UdpSocket::bind("127.0.0.1:0")
        .await
        .context("binding qa udp socket")?;
    let keys = key_fixture(args.keys)?;

    for seq in 1..=args.frames {
        let frame = Frame::state(seq, seq, &keys);
        socket
            .send_to(&frame.encode(), args.target)
            .await
            .with_context(|| format!("sending frame {seq} to {}", args.target))?;
    }

    println!(
        "sent {} udp frames to {} with {} keys",
        args.frames,
        args.target,
        keys.len()
    );
    Ok(())
}

fn key_fixture(count: u16) -> anyhow::Result<Vec<KeyCode>> {
    let mut keys = Vec::with_capacity(usize::from(count));
    for offset in 0..count {
        let raw = offset
            .checked_add(4)
            .context("key fixture offset overflow")?;
        let key = KeyCode::from_wire(raw).context("invalid key fixture")?;
        keys.push(key);
    }
    Ok(keys)
}
