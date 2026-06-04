use remotepad::{keymap::windows_scan_code_for_dom_code, protocol::KeyCode};

#[test]
fn maps_dom_letter_to_windows_scan_code() {
    assert_eq!(
        windows_scan_code_for_dom_code("KeyZ"),
        KeyCode::from_wire(0x2C)
    );
}

#[test]
fn maps_windows_extended_arrow_scan_code() {
    assert_eq!(
        windows_scan_code_for_dom_code("ArrowUp"),
        KeyCode::from_wire(0xFF00 | 0x48)
    );
}

#[test]
fn rejects_unknown_dom_code() {
    assert!(windows_scan_code_for_dom_code("Nope").is_none());
}
