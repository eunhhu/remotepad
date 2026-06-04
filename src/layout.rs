use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LayoutError {
    #[error("invalid layout json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid layout name")]
    InvalidName,
    #[error("layout file io failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("layout persist failed: {0}")]
    Persist(#[from] tempfile::PersistError),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Layout {
    #[serde(rename = "canvasSize")]
    canvas_size: CanvasSize,
    controls: Vec<Control>,
}

impl Layout {
    pub fn from_json(input: &str) -> Result<Self, LayoutError> {
        let layout: Self = serde_json::from_str(input)?;
        Ok(layout)
    }

    pub fn default_editor() -> Self {
        Self {
            canvas_size: CanvasSize {
                width: "820px".to_string(),
                height: "420px".to_string(),
            },
            controls: vec![
                button("32px", "272px", "88px", "88px", "18px", "KeyZ"),
                button("136px", "248px", "88px", "88px", "18px", "KeyX"),
                button("240px", "272px", "88px", "88px", "18px", "KeyC"),
                button("600px", "84px", "82px", "82px", "999px", "ArrowUp"),
                button("516px", "170px", "82px", "82px", "999px", "ArrowLeft"),
                button("684px", "170px", "82px", "82px", "999px", "ArrowRight"),
                button("600px", "256px", "82px", "82px", "999px", "ArrowDown"),
            ],
        }
    }

    pub fn to_pretty_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn controls_len(&self) -> usize {
        self.controls.len()
    }
}

fn button(left: &str, top: &str, width: &str, height: &str, radius: &str, key: &str) -> Control {
    Control {
        kind: ControlKind::Button,
        left: left.to_string(),
        top: top.to_string(),
        width: width.to_string(),
        height: height.to_string(),
        border_radius: radius.to_string(),
        transform: String::new(),
        key: key.to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanvasSize {
    width: String,
    height: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Control {
    #[serde(rename = "type")]
    kind: ControlKind,
    left: String,
    top: String,
    width: String,
    height: String,
    #[serde(rename = "borderRadius", default)]
    border_radius: String,
    #[serde(default)]
    transform: String,
    #[serde(default)]
    key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ControlKind {
    Button,
    Joystick,
    MouseZone,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct LayoutName(String);

impl LayoutName {
    pub fn parse(input: &str) -> Result<Self, LayoutError> {
        let valid = !input.is_empty()
            && input.len() <= 64
            && input
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
        if valid {
            Ok(Self(input.to_string()))
        } else {
            Err(LayoutError::InvalidName)
        }
    }

    fn file_name(&self) -> String {
        format!("{}.json", self.0)
    }

    pub fn is_default(&self) -> bool {
        self.0 == "default"
    }
}

#[derive(Debug, Clone)]
pub struct LayoutStore {
    root: PathBuf,
    default_path: Option<PathBuf>,
}

impl LayoutStore {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            default_path: None,
        }
    }

    pub fn with_default_path(root: PathBuf, default_path: PathBuf) -> Self {
        Self {
            root,
            default_path: Some(default_path),
        }
    }

    pub fn save(&self, name: &LayoutName, layout: &Layout) -> Result<(), LayoutError> {
        save_layout_file(&self.path_for(name), layout)
    }

    pub fn load(&self, name: &LayoutName) -> Result<Layout, LayoutError> {
        let content = fs::read_to_string(self.path_for(name))?;
        Layout::from_json(&content)
    }

    fn path_for(&self, name: &LayoutName) -> PathBuf {
        if name.is_default()
            && let Some(default_path) = &self.default_path
        {
            return default_path.clone();
        }
        self.root.join(name.file_name())
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}

pub fn save_layout_file(path: &Path, layout: &Layout) -> Result<(), LayoutError> {
    let parent = path.parent().ok_or_else(|| {
        LayoutError::Io(io::Error::new(
            io::ErrorKind::InvalidInput,
            "layout path has no parent",
        ))
    })?;
    fs::create_dir_all(parent)?;
    let json = layout.to_pretty_json();
    let mut temp = NamedTempFile::new_in(parent)?;
    std::io::Write::write_all(&mut temp, json.as_bytes())?;
    temp.persist(path)?;
    Ok(())
}
