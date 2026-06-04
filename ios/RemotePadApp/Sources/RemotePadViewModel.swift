import Foundation
import Observation

@Observable
final class RemotePadViewModel {
    var host = "127.0.0.1"
    var portText = "3001"
    var status = "Idle"
    private(set) var connected = false

    private var sequence: UInt64 = 1
    private var sender: UdpInputSender?

    func connect() {
        guard let port = UInt16(portText) else {
            status = "Invalid port"
            return
        }
        sender?.cancel()
        do {
            let nextSender = try UdpInputSender(host: host, port: port)
            nextSender.start()
            sender = nextSender
            connected = true
            status = "Connected \(nextSender.endpointDescription)"
        } catch {
            connected = false
            status = "Connect failed: \(error)"
        }
    }

    func tapKeyZ() {
        do {
            let key = try KeyCode(wireValue: 29)
            send(.keyEvent(sequence: nextSequence(), clientTimeMicros: nowMicros(), key: key, pressed: true))
            send(.keyEvent(sequence: nextSequence(), clientTimeMicros: nowMicros(), key: key, pressed: false))
        } catch {
            status = "Tap failed: \(error)"
        }
    }

    func sendTwelveKeyState() {
        do {
            let keys = try (4..<16).map { try KeyCode(wireValue: UInt16($0)) }
            send(.state(sequence: nextSequence(), clientTimeMicros: nowMicros(), keys: keys))
        } catch {
            status = "State failed: \(error)"
        }
    }

    private func send(_ frame: InputFrame) {
        if sender == nil {
            connect()
        }
        guard let sender else {
            return
        }
        sender.send(frame) { [weak self] error in
            Task { @MainActor in
                self?.status = error.map { "UDP error: \($0)" } ?? "Sent \(sender.endpointDescription)"
            }
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
