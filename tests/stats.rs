use remotepad::stats::InputStats;

#[test]
fn stats_tracks_applied_and_malformed_frames() {
    let stats = InputStats::default();

    stats.record_applied(700);
    stats.record_malformed();

    assert_eq!(stats.applied(), 1);
    assert_eq!(stats.malformed(), 1);
    assert_eq!(stats.p99_dispatch_us(), Some(700));
}
