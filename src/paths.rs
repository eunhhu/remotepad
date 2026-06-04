use std::path::{Path, PathBuf};

pub fn resolve_existing_public_dir(public_dir: &Path, exe_path: &Path, cwd: &Path) -> PathBuf {
    if public_dir.is_absolute() {
        return public_dir.to_path_buf();
    }

    let exe_dir = exe_path.parent().unwrap_or(cwd);
    let mut candidates = vec![
        cwd.join(public_dir),
        exe_dir.join(public_dir),
        exe_dir.parent().unwrap_or(exe_dir).join(public_dir),
    ];
    candidates.dedup();

    candidates
        .into_iter()
        .find(|candidate| candidate.join("index.html").is_file())
        .unwrap_or_else(|| cwd.join(public_dir))
}
