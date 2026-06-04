use std::fs;

use remotepad::paths::resolve_existing_public_dir;

#[test]
fn resolves_web_dist_from_release_root_when_binary_runs_in_bin_dir() {
    let temp = tempfile::tempdir().expect("temp dir");
    let release_root = temp.path().join("remotepad");
    let bin_dir = release_root.join("bin");
    let public_dir = release_root.join("web/dist");
    fs::create_dir_all(&bin_dir).expect("bin dir");
    fs::create_dir_all(&public_dir).expect("public dir");
    fs::write(public_dir.join("index.html"), "ok").expect("index");

    let resolved =
        resolve_existing_public_dir("web/dist".as_ref(), &bin_dir.join("remotepad"), &bin_dir);

    assert_eq!(resolved, public_dir);
}
