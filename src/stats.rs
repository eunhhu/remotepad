use std::sync::{
    Mutex, MutexGuard,
    atomic::{AtomicU64, Ordering},
};

use serde::Serialize;

#[derive(Debug, Default)]
pub struct InputStats {
    received: AtomicU64,
    applied: AtomicU64,
    malformed: AtomicU64,
    stale: AtomicU64,
    dropped: AtomicU64,
    dispatch_us: Mutex<Vec<u64>>,
}

impl InputStats {
    pub fn record_received(&self) {
        self.received.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_applied(&self, dispatch_us: u64) {
        self.applied.fetch_add(1, Ordering::Relaxed);
        self.latencies().push(dispatch_us);
    }

    pub fn record_malformed(&self) {
        self.malformed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_stale(&self) {
        self.stale.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_dropped(&self) {
        self.dropped.fetch_add(1, Ordering::Relaxed);
    }

    pub fn applied(&self) -> u64 {
        self.applied.load(Ordering::Relaxed)
    }

    pub fn malformed(&self) -> u64 {
        self.malformed.load(Ordering::Relaxed)
    }

    pub fn p99_dispatch_us(&self) -> Option<u64> {
        percentile_99(&self.latencies())
    }

    pub fn snapshot(&self) -> StatsSnapshot {
        StatsSnapshot {
            received: self.received.load(Ordering::Relaxed),
            applied: self.applied(),
            malformed: self.malformed(),
            stale: self.stale.load(Ordering::Relaxed),
            dropped: self.dropped.load(Ordering::Relaxed),
            p99_dispatch_us: self.p99_dispatch_us(),
        }
    }

    fn latencies(&self) -> MutexGuard<'_, Vec<u64>> {
        match self.dispatch_us.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct StatsSnapshot {
    pub received: u64,
    pub applied: u64,
    pub malformed: u64,
    pub stale: u64,
    pub dropped: u64,
    pub p99_dispatch_us: Option<u64>,
}

fn percentile_99(values: &[u64]) -> Option<u64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let idx = (sorted.len() - 1) * 99 / 100;
    sorted.get(idx).copied()
}
