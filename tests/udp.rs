use std::{net::SocketAddr, sync::Arc};

use remotepad::{
    input::NoopInputSink,
    protocol::{Frame, KeyCode},
    stats::InputStats,
    udp::UdpInputServer,
};

#[tokio::test]
async fn udp_server_applies_valid_key_event_when_received() {
    let sink = NoopInputSink::default();
    let stats = Arc::new(InputStats::default());
    let server = UdpInputServer::bind("127.0.0.1:0", sink, Arc::clone(&stats))
        .await
        .expect("udp server binds");
    let addr: SocketAddr = server.local_addr();
    let handle = tokio::spawn(server.run_until_frames(1));

    let socket = tokio::net::UdpSocket::bind("127.0.0.1:0")
        .await
        .expect("client socket");
    let key = KeyCode::from_wire(4).unwrap();
    let bytes = Frame::key_event(1, 42, key, true).encode();
    socket.send_to(&bytes, addr).await.expect("frame sent");

    let actor = handle.await.expect("task join").expect("server result");
    assert_eq!(actor.sink().press_count(), 1);
    assert_eq!(stats.applied(), 1);
}

#[tokio::test]
async fn udp_server_counts_malformed_frame_without_crashing() {
    let sink = NoopInputSink::default();
    let stats = Arc::new(InputStats::default());
    let server = UdpInputServer::bind("127.0.0.1:0", sink, Arc::clone(&stats))
        .await
        .expect("udp server binds");
    let addr = server.local_addr();
    let handle = tokio::spawn(server.run_until_frames(1));

    let socket = tokio::net::UdpSocket::bind("127.0.0.1:0")
        .await
        .expect("client socket");
    socket
        .send_to(&[1, 2, 3], addr)
        .await
        .expect("bad frame sent");

    let actor = handle.await.expect("task join").expect("server result");
    assert_eq!(actor.sink().events().len(), 0);
    assert_eq!(stats.malformed(), 1);
}
