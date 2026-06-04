use std::{net::SocketAddr, sync::Arc, time::Instant};

use thiserror::Error;
use tokio::net::UdpSocket;

use crate::{
    input::{InputActor, InputError, InputSink},
    protocol::{Frame, ProtocolError, SequenceTracker},
    stats::InputStats,
};

#[derive(Debug, Error)]
pub enum UdpError {
    #[error("udp io failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("protocol failed: {0}")]
    Protocol(#[from] ProtocolError),
    #[error("input failed: {0}")]
    Input(#[from] InputError),
}

#[derive(Debug)]
pub struct UdpInputServer<Sink: InputSink> {
    socket: UdpSocket,
    actor: InputActor<Sink>,
    stats: Arc<InputStats>,
    sequence: SequenceTracker,
}

impl<Sink> UdpInputServer<Sink>
where
    Sink: InputSink,
{
    pub async fn bind(
        addr: impl tokio::net::ToSocketAddrs,
        sink: Sink,
        stats: Arc<InputStats>,
    ) -> Result<Self, UdpError> {
        let socket = UdpSocket::bind(addr).await?;
        Ok(Self {
            socket,
            actor: InputActor::new(sink),
            stats,
            sequence: SequenceTracker::default(),
        })
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.socket
            .local_addr()
            .unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], 0)))
    }

    pub async fn run_until_frames(
        mut self,
        frame_limit: u64,
    ) -> Result<InputActor<Sink>, UdpError> {
        let mut processed = 0_u64;
        let mut buffer = [0_u8; 256];
        while processed < frame_limit {
            let (len, _) = self.socket.recv_from(&mut buffer).await?;
            self.stats.record_received();
            processed += 1;
            match Frame::decode(&buffer[..len]) {
                Ok(frame) => {
                    if self.sequence.accepts(frame.sequence()) {
                        let started = Instant::now();
                        if self.actor.apply_frame(&frame).is_ok() {
                            self.stats.record_applied(elapsed_us(started));
                        } else {
                            self.stats.record_dropped();
                        }
                    } else {
                        self.stats.record_stale();
                    }
                }
                Err(_) => self.stats.record_malformed(),
            }
        }
        Ok(self.actor)
    }

    pub async fn run_forever(mut self) -> Result<(), UdpError> {
        let mut buffer = [0_u8; 256];
        loop {
            let (len, _) = self.socket.recv_from(&mut buffer).await?;
            self.stats.record_received();
            match Frame::decode(&buffer[..len]) {
                Ok(frame) if self.sequence.accepts(frame.sequence()) => {
                    let started = Instant::now();
                    if self.actor.apply_frame(&frame).is_ok() {
                        self.stats.record_applied(elapsed_us(started));
                    } else {
                        self.stats.record_dropped();
                    }
                }
                Ok(_) => self.stats.record_stale(),
                Err(_) => self.stats.record_malformed(),
            }
        }
    }
}

fn elapsed_us(started: Instant) -> u64 {
    let micros = started.elapsed().as_micros();
    u64::try_from(micros).unwrap_or(u64::MAX)
}
