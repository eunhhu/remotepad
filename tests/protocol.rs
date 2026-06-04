use remotepad::protocol::{Frame, KeyCode, SequenceTracker};

#[test]
fn decodes_twelve_key_state_frame_when_valid() {
    let keys: Vec<KeyCode> = (0..12)
        .map(|idx| KeyCode::from_wire(idx + 4).unwrap())
        .collect();
    let bytes = Frame::state(7, 1234, &keys).encode();

    let decoded = Frame::decode(&bytes).expect("state frame decodes");

    assert_eq!(decoded.sequence(), 7);
    assert_eq!(decoded.pressed_keys().len(), 12);
}

#[test]
fn rejects_stale_sequence_when_lower_than_last_seen() {
    let mut tracker = SequenceTracker::default();
    assert!(tracker.accepts(9));
    assert!(!tracker.accepts(8));
}

#[test]
fn rejects_malformed_frame_when_too_short() {
    let err = Frame::decode(&[1, 2, 3]).expect_err("short frame rejected");
    assert!(err.to_string().contains("short"));
}

#[test]
fn encodes_key_press_event_when_valid() {
    let key = KeyCode::from_wire(4).unwrap();
    let bytes = Frame::key_event(1, 200, key, true).encode();
    let decoded = Frame::decode(&bytes).expect("event decodes");

    assert_eq!(decoded.sequence(), 1);
    assert_eq!(decoded.as_key_event().unwrap().key, key);
    assert!(decoded.as_key_event().unwrap().pressed);
}
