use remotepad::{
    input::{InputActor, InputError, InputSink, NoopInputSink},
    protocol::KeyCode,
};
use std::{cell::RefCell, rc::Rc};

#[test]
fn ignores_duplicate_press_when_key_already_held() {
    let sink = NoopInputSink::default();
    let mut actor = InputActor::new(sink);
    let key = KeyCode::from_wire(4).unwrap();

    actor.apply_key_event(key, true).expect("first press");
    actor.apply_key_event(key, true).expect("duplicate press");

    assert_eq!(actor.sink().events().len(), 1);
}

#[test]
fn releases_all_keys_when_peer_disconnects() {
    let sink = NoopInputSink::default();
    let mut actor = InputActor::new(sink);
    let keys: Vec<KeyCode> = (0..12)
        .map(|idx| KeyCode::from_wire(idx + 4).unwrap())
        .collect();

    actor.apply_state(&keys).expect("state applied");
    actor.release_all().expect("all released");

    assert_eq!(actor.sink().press_count(), 12);
    assert_eq!(actor.sink().release_count(), 12);
}

#[test]
fn applies_state_frame_by_releasing_missing_keys() {
    let sink = NoopInputSink::default();
    let mut actor = InputActor::new(sink);
    let key_a = KeyCode::from_wire(4).unwrap();
    let key_b = KeyCode::from_wire(5).unwrap();

    actor
        .apply_state(&[key_a, key_b])
        .expect("two keys pressed");
    actor.apply_state(&[key_b]).expect("one key remains");

    assert_eq!(actor.sink().press_count(), 2);
    assert_eq!(actor.sink().release_count(), 1);
}

#[test]
fn drops_actor_releases_held_keys_when_shutdown() {
    #[derive(Clone)]
    struct SharedSink(Rc<RefCell<Vec<bool>>>);

    impl InputSink for SharedSink {
        fn key(&mut self, _key: KeyCode, pressed: bool) -> Result<(), InputError> {
            self.0.borrow_mut().push(pressed);
            Ok(())
        }
    }

    let events = Rc::new(RefCell::new(Vec::new()));
    let key = KeyCode::from_wire(4).unwrap();

    {
        let sink = SharedSink(Rc::clone(&events));
        let mut actor = InputActor::new(sink);
        actor.apply_key_event(key, true).expect("press");
    }

    assert_eq!(events.borrow().as_slice(), &[true, false]);
}
