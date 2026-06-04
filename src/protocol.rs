use std::fmt;

use thiserror::Error;

const MAGIC: u8 = 0x52;
const VERSION: u8 = 1;
const HEADER_LEN: usize = 20;
const KEY_BYTES: usize = 2;
pub const MAX_KEYS: usize = 32;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ProtocolError {
    #[error("frame too short")]
    ShortFrame,
    #[error("invalid frame magic")]
    InvalidMagic,
    #[error("unsupported frame version {0}")]
    UnsupportedVersion(u8),
    #[error("unknown frame kind {0}")]
    UnknownKind(u8),
    #[error("invalid key code {0}")]
    InvalidKey(u16),
    #[error("state frame has too many keys: {0}")]
    TooManyKeys(usize),
    #[error("state frame key payload is truncated")]
    TruncatedKeys,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct KeyCode(u16);

impl KeyCode {
    pub const fn from_wire(value: u16) -> Option<Self> {
        if value == 0 { None } else { Some(Self(value)) }
    }

    pub const fn as_wire(self) -> u16 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeyEvent {
    pub key: KeyCode,
    pub pressed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FrameKind {
    KeyEvent,
    KeyState,
}

impl FrameKind {
    const fn as_wire(self) -> u8 {
        match self {
            Self::KeyEvent => 1,
            Self::KeyState => 2,
        }
    }

    const fn from_wire(value: u8) -> Result<Self, ProtocolError> {
        match value {
            1 => Ok(Self::KeyEvent),
            2 => Ok(Self::KeyState),
            other => Err(ProtocolError::UnknownKind(other)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    kind: FrameKind,
    sequence: u64,
    client_time_us: u64,
    key_event: Option<KeyEvent>,
    keys: [KeyCode; MAX_KEYS],
    key_len: usize,
}

impl Frame {
    pub fn key_event(sequence: u64, client_time_us: u64, key: KeyCode, pressed: bool) -> Self {
        Self {
            kind: FrameKind::KeyEvent,
            sequence,
            client_time_us,
            key_event: Some(KeyEvent { key, pressed }),
            keys: [KeyCode(1); MAX_KEYS],
            key_len: 0,
        }
    }

    pub fn state(sequence: u64, client_time_us: u64, keys: &[KeyCode]) -> Self {
        let mut fixed = [KeyCode(1); MAX_KEYS];
        let key_len = keys.len().min(MAX_KEYS);
        fixed[..key_len].copy_from_slice(&keys[..key_len]);
        Self {
            kind: FrameKind::KeyState,
            sequence,
            client_time_us,
            key_event: None,
            keys: fixed,
            key_len,
        }
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ProtocolError> {
        if bytes.len() < HEADER_LEN {
            return Err(ProtocolError::ShortFrame);
        }
        if bytes[0] != MAGIC {
            return Err(ProtocolError::InvalidMagic);
        }
        if bytes[1] != VERSION {
            return Err(ProtocolError::UnsupportedVersion(bytes[1]));
        }

        let kind = FrameKind::from_wire(bytes[2])?;
        let flags_or_count = bytes[3];
        let sequence = read_u64(bytes, 4);
        let client_time_us = read_u64(bytes, 12);

        match kind {
            FrameKind::KeyEvent => Self::decode_key_event(bytes, sequence, client_time_us),
            FrameKind::KeyState => {
                Self::decode_key_state(bytes, sequence, client_time_us, usize::from(flags_or_count))
            }
        }
    }

    fn decode_key_event(
        bytes: &[u8],
        sequence: u64,
        client_time_us: u64,
    ) -> Result<Self, ProtocolError> {
        if bytes.len() < HEADER_LEN + KEY_BYTES {
            return Err(ProtocolError::ShortFrame);
        }
        let raw = u16::from_le_bytes([bytes[HEADER_LEN], bytes[HEADER_LEN + 1]]);
        let key = KeyCode::from_wire(raw).ok_or(ProtocolError::InvalidKey(raw))?;
        let pressed = bytes[3] != 0;
        Ok(Self::key_event(sequence, client_time_us, key, pressed))
    }

    fn decode_key_state(
        bytes: &[u8],
        sequence: u64,
        client_time_us: u64,
        count: usize,
    ) -> Result<Self, ProtocolError> {
        if count > MAX_KEYS {
            return Err(ProtocolError::TooManyKeys(count));
        }
        let expected = HEADER_LEN + count * KEY_BYTES;
        if bytes.len() < expected {
            return Err(ProtocolError::TruncatedKeys);
        }
        let mut keys = [KeyCode(1); MAX_KEYS];
        for (idx, slot) in keys.iter_mut().take(count).enumerate() {
            let offset = HEADER_LEN + idx * KEY_BYTES;
            let raw = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
            *slot = KeyCode::from_wire(raw).ok_or(ProtocolError::InvalidKey(raw))?;
        }
        Ok(Self {
            kind: FrameKind::KeyState,
            sequence,
            client_time_us,
            key_event: None,
            keys,
            key_len: count,
        })
    }

    pub fn encode(&self) -> Vec<u8> {
        let payload_len = match self.kind {
            FrameKind::KeyEvent => KEY_BYTES,
            FrameKind::KeyState => self.key_len * KEY_BYTES,
        };
        let mut bytes = Vec::with_capacity(HEADER_LEN + payload_len);
        bytes.push(MAGIC);
        bytes.push(VERSION);
        bytes.push(self.kind.as_wire());
        bytes.push(self.flags_or_count());
        bytes.extend_from_slice(&self.sequence.to_le_bytes());
        bytes.extend_from_slice(&self.client_time_us.to_le_bytes());
        match self.kind {
            FrameKind::KeyEvent => {
                if let Some(event) = self.key_event {
                    bytes.extend_from_slice(&event.key.as_wire().to_le_bytes());
                }
            }
            FrameKind::KeyState => {
                for key in self.pressed_keys() {
                    bytes.extend_from_slice(&key.as_wire().to_le_bytes());
                }
            }
        }
        bytes
    }

    pub const fn sequence(&self) -> u64 {
        self.sequence
    }

    pub fn pressed_keys(&self) -> &[KeyCode] {
        &self.keys[..self.key_len]
    }

    pub const fn as_key_event(&self) -> Option<KeyEvent> {
        self.key_event
    }

    const fn flags_or_count(&self) -> u8 {
        match self.kind {
            FrameKind::KeyEvent => match self.key_event {
                Some(event) if event.pressed => 1,
                Some(_) | None => 0,
            },
            FrameKind::KeyState => self.key_len as u8,
        }
    }

    pub const fn is_state(&self) -> bool {
        matches!(self.kind, FrameKind::KeyState)
    }
}

#[derive(Debug, Clone, Default)]
pub struct SequenceTracker {
    last_seen: Option<u64>,
}

impl SequenceTracker {
    pub fn accepts(&mut self, sequence: u64) -> bool {
        let accepted = self.last_seen.is_none_or(|last| sequence > last);
        if accepted {
            self.last_seen = Some(sequence);
        }
        accepted
    }
}

impl fmt::Display for KeyCode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.0)
    }
}

fn read_u64(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
    ])
}
