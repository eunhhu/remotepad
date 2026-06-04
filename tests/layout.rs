use std::path::PathBuf;

use remotepad::layout::{Layout, LayoutName, LayoutStore};

fn fixture_layout() -> &'static str {
    r#"{
      "canvasSize": { "width": "915px", "height": "440px" },
      "controls": [
        { "type": "Button", "left": "0px", "top": "0px", "width": "90px", "height": "90px", "borderRadius": "", "transform": "", "key": "KeyA" },
        { "type": "MouseZone", "left": "90px", "top": "0px", "width": "90px", "height": "90px", "borderRadius": "", "transform": "", "key": "" }
      ]
    }"#
}

#[test]
fn layout_round_trip_when_valid() {
    let layout = Layout::from_json(fixture_layout()).expect("valid layout parses");
    assert_eq!(layout.controls_len(), 2);
    assert!(layout.to_pretty_json().contains("\"canvasSize\""));
}

#[test]
fn rejects_malformed_layout_when_missing_controls() {
    let err = Layout::from_json(r#"{"canvasSize":{"width":"1px","height":"1px"}}"#)
        .expect_err("missing controls rejected");
    assert!(err.to_string().contains("controls"));
}

#[test]
fn rejects_layout_name_when_path_traversal() {
    let err = LayoutName::parse("../save").expect_err("path traversal rejected");
    assert!(err.to_string().contains("layout name"));
}

#[test]
fn saves_and_loads_layout_atomically_when_valid() {
    let temp = tempfile::tempdir().expect("temp dir");
    let store = LayoutStore::new(PathBuf::from(temp.path()));
    let name = LayoutName::parse("qa").expect("valid name");
    let layout = Layout::from_json(fixture_layout()).expect("valid layout");

    store.save(&name, &layout).expect("layout saved");
    let loaded = store.load(&name).expect("layout loaded");

    assert_eq!(loaded.controls_len(), 2);
}
