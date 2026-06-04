use std::collections::BTreeSet;

use enigo::{Direction, Enigo, Keyboard, Settings};
use thiserror::Error;

use crate::protocol::KeyCode;

#[derive(Debug, Error)]
pub enum InputError {
    #[error("input backend failed: {0}")]
    Backend(String),
}

pub trait InputSink {
    fn key(&mut self, key: KeyCode, pressed: bool) -> Result<(), InputError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InputEvent {
    pub key: KeyCode,
    pub pressed: bool,
}

#[derive(Debug, Default, Clone)]
pub struct NoopInputSink {
    events: Vec<InputEvent>,
}

impl NoopInputSink {
    pub fn events(&self) -> &[InputEvent] {
        &self.events
    }

    pub fn press_count(&self) -> usize {
        self.events.iter().filter(|event| event.pressed).count()
    }

    pub fn release_count(&self) -> usize {
        self.events.iter().filter(|event| !event.pressed).count()
    }
}

impl InputSink for NoopInputSink {
    fn key(&mut self, key: KeyCode, pressed: bool) -> Result<(), InputError> {
        self.events.push(InputEvent { key, pressed });
        Ok(())
    }
}

#[derive(Debug)]
pub struct EnigoInputSink {
    enigo: Enigo,
}

impl EnigoInputSink {
    pub fn new() -> Result<Self, InputError> {
        let enigo =
            Enigo::new(&Settings::default()).map_err(|err| InputError::Backend(err.to_string()))?;
        Ok(Self { enigo })
    }
}

impl InputSink for EnigoInputSink {
    fn key(&mut self, key: KeyCode, pressed: bool) -> Result<(), InputError> {
        let direction = if pressed {
            Direction::Press
        } else {
            Direction::Release
        };
        self.enigo
            .raw(key.as_wire(), direction)
            .map_err(|err| InputError::Backend(err.to_string()))
    }
}

#[derive(Debug)]
pub struct InputActor<Sink: InputSink> {
    sink: Sink,
    held: BTreeSet<KeyCode>,
}

impl<Sink> InputActor<Sink>
where
    Sink: InputSink,
{
    pub fn new(sink: Sink) -> Self {
        Self {
            sink,
            held: BTreeSet::new(),
        }
    }

    pub fn apply_key_event(&mut self, key: KeyCode, pressed: bool) -> Result<(), InputError> {
        if pressed {
            if self.held.insert(key) {
                self.sink.key(key, true)?;
            }
        } else if self.held.remove(&key) {
            self.sink.key(key, false)?;
        }
        Ok(())
    }

    pub fn apply_state(&mut self, keys: &[KeyCode]) -> Result<(), InputError> {
        let desired: BTreeSet<KeyCode> = keys.iter().copied().collect();
        let to_release: Vec<KeyCode> = self.held.difference(&desired).copied().collect();
        let to_press: Vec<KeyCode> = desired.difference(&self.held).copied().collect();

        for key in to_release {
            self.apply_key_event(key, false)?;
        }
        for key in to_press {
            self.apply_key_event(key, true)?;
        }
        Ok(())
    }

    pub fn apply_frame(&mut self, frame: &crate::protocol::Frame) -> Result<(), InputError> {
        if frame.is_state() {
            self.apply_state(frame.pressed_keys())
        } else if let Some(event) = frame.as_key_event() {
            self.apply_key_event(event.key, event.pressed)
        } else {
            Ok(())
        }
    }

    pub fn release_all(&mut self) -> Result<(), InputError> {
        let keys: Vec<KeyCode> = self.held.iter().copied().collect();
        for key in keys {
            self.apply_key_event(key, false)?;
        }
        Ok(())
    }

    pub fn sink(&self) -> &Sink {
        &self.sink
    }
}

impl<Sink> Drop for InputActor<Sink>
where
    Sink: InputSink,
{
    fn drop(&mut self) {
        let keys: Vec<KeyCode> = self.held.iter().copied().collect();
        for key in keys {
            if self.sink.key(key, false).is_ok() {
                self.held.remove(&key);
            }
        }
    }
}
