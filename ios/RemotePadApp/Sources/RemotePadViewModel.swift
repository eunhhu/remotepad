import Foundation
import Observation

@MainActor
@Observable
final class RemotePadViewModel {
    var host = ""
    var httpPortText = "3000"
    var udpPortText = "3001"
    var status = "Enter the Windows host IP, then connect"
    private(set) var connected = false
    private(set) var layout: Layout?
    private(set) var stats: ServerStats?

    private var sequence: UInt64 = 1
    private var sender: UdpInputSender?
    private var httpClient: RemotePadHttpClient?
    private var activeKeyCounts: [String: Int] = [:]

    func connect() {
        Task {
            await connectToServer()
        }
    }

    func reloadLayout() {
        Task {
            await loadLayout()
        }
    }

    func press(_ control: Control) {
        guard control.type == .Button else {
            status = "\(control.type.rawValue) input is not wired yet"
            return
        }
        guard !control.key.isEmpty else {
            status = "Control has no key binding"
            return
        }
        do {
            _ = try KeyCode(layoutCode: control.key)
            let activeCount = activeKeyCounts[control.key, default: 0]
            activeKeyCounts[control.key] = activeCount + 1
            if activeCount == 0 {
                sendPressedStateSnapshot(label: "\(control.key) down")
            }
        } catch {
            status = "Unsupported key \(control.key): \(error)"
        }
    }

    func release(_ control: Control) {
        guard !control.key.isEmpty else {
            return
        }
        let activeCount = activeKeyCounts[control.key, default: 0]
        guard activeCount > 0 else {
            return
        }
        if activeCount == 1 {
            activeKeyCounts.removeValue(forKey: control.key)
        } else {
            activeKeyCounts[control.key] = activeCount - 1
            return
        }
        do {
            _ = try KeyCode(layoutCode: control.key)
            sendPressedStateSnapshot(label: "\(control.key) up")
        } catch {
            status = "Unsupported key \(control.key): \(error)"
        }
    }

    func releaseAll(reason: String = "release all") {
        guard !activeKeyCounts.isEmpty else {
            return
        }
        activeKeyCounts.removeAll(keepingCapacity: true)
        sendPressedStateSnapshot(label: reason)
    }

    func sendTwelveKeyState() {
        do {
            let layoutCodes = ["KeyZ", "KeyX", "KeyC", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY"]
            let keys = try layoutCodes.map { try KeyCode(layoutCode: $0) }
            send(.state(sequence: nextSequence(), clientTimeMicros: nowMicros(), keys: keys), label: "12-key state")
        } catch {
            status = "State failed: \(error)"
        }
    }

    private func connectToServer() async {
        let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHost.isEmpty else {
            status = "Host required. Use the Windows LAN IP."
            return
        }
        guard !["127.0.0.1", "localhost", "::1"].contains(trimmedHost.lowercased()) else {
            status = "Use the Windows LAN IP. \(trimmedHost) is this iPhone."
            return
        }
        guard let httpPort = UInt16(httpPortText), let udpPort = UInt16(udpPortText) else {
            status = "Invalid HTTP or UDP port"
            return
        }
        connected = false
        sender?.cancel()
        sender = nil
        httpClient = nil
        status = "Checking http://\(trimmedHost):\(httpPort)"

        do {
            let client = try RemotePadHttpClient(host: trimmedHost, port: httpPort)
            let connectResponse = try await client.connect()
            try await client.fetchHealth()
            let loadedLayout = try await client.fetchLayout(name: "default")
            let initialStats = try await client.fetchStats()
            let effectiveUdpPort = connectResponse.udpPort ?? udpPort
            let nextSender = try UdpInputSender(host: trimmedHost, port: effectiveUdpPort)
            nextSender.start()

            self.httpClient = client
            self.sender = nextSender
            self.udpPortText = String(effectiveUdpPort)
            self.layout = loadedLayout
            self.stats = initialStats
            self.connected = true
            self.status = "Connected. Loaded \(loadedLayout.controls.count) controls. UDP \(effectiveUdpPort)."
        } catch {
            connected = false
            layout = nil
            stats = nil
            status = "Connect failed: \(error)"
        }
    }

    private func loadLayout() async {
        guard let httpClient else {
            await connectToServer()
            return
        }
        do {
            layout = try await httpClient.fetchLayout(name: "default")
            stats = try await httpClient.fetchStats()
            status = "Layout reloaded."
        } catch {
            status = "Reload failed: \(error)"
        }
    }

    private func send(_ frame: InputFrame, label: String) {
        send(frame, label: label, reportStatus: true)
    }

    private func send(_ frame: InputFrame, label: String, reportStatus: Bool) {
        guard let sender else {
            if reportStatus {
                status = "Connect first"
            }
            return
        }
        let previousReceived = stats?.received ?? 0
        sender.send(frame) { [weak self] error in
            Task { @MainActor in
                guard let self else {
                    return
                }
                if let error {
                    if reportStatus {
                        self.status = "UDP local error: \(error)"
                    }
                } else if reportStatus {
                    await self.confirmServerReceived(previousReceived: previousReceived, label: label)
                }
            }
        }
    }

    private func sendPressedStateSnapshot(label: String) {
        do {
            let keys = try activeKeyCounts.keys.sorted().map { try KeyCode(layoutCode: $0) }
            send(.state(sequence: nextSequence(), clientTimeMicros: nowMicros(), keys: keys), label: label)
            if keys.isEmpty {
                sendRedundantEmptyState()
            }
        } catch {
            status = "State encode failed: \(error)"
        }
    }

    private func sendRedundantEmptyState() {
        Task { @MainActor in
            for delay in [12_000_000, 24_000_000] as [UInt64] {
                try? await Task.sleep(nanoseconds: delay)
                guard activeKeyCounts.isEmpty else {
                    return
                }
                send(
                    .state(sequence: nextSequence(), clientTimeMicros: nowMicros(), keys: []),
                    label: "release retry",
                    reportStatus: false
                )
            }
        }
    }

    private func confirmServerReceived(previousReceived: UInt64, label: String) async {
        guard let httpClient else {
            status = "UDP sent locally: \(label)"
            return
        }
        try? await Task.sleep(nanoseconds: 60_000_000)
        do {
            let nextStats = try await httpClient.fetchStats()
            stats = nextStats
            if nextStats.received > previousReceived {
                status = "Server received UDP: \(label)"
            } else {
                status = "UDP sent locally, server stats unchanged: \(label)"
            }
        } catch {
            status = "UDP sent locally; stats check failed: \(error)"
        }
    }

    private func nextSequence() -> UInt64 {
        defer { sequence += 1 }
        return sequence
    }
}

private func nowMicros() -> UInt64 {
    UInt64(Date().timeIntervalSince1970 * 1_000_000)
}
