import Foundation

private let frameMagic: UInt8 = 0x52
private let frameVersion: UInt8 = 1
private let maxKeys = 32

public enum ProtocolEncodingError: Error, Equatable, Sendable {
    case invalidKeyCode(UInt16)
}

public struct KeyCode: Equatable, Hashable, Sendable {
    public let wireValue: UInt16

    public init(wireValue: UInt16) throws {
        guard wireValue > 0, wireValue <= 512 else {
            throw ProtocolEncodingError.invalidKeyCode(wireValue)
        }
        self.wireValue = wireValue
    }
}

public struct InputFrame: Equatable, Sendable {
    private enum Kind: UInt8, Sendable {
        case keyEvent = 1
        case state = 2
    }

    private let kind: Kind
    private let sequence: UInt64
    private let clientTimeMicros: UInt64
    private let keyEvent: KeyEvent?
    private let keys: [KeyCode]

    private struct KeyEvent: Equatable, Sendable {
        let key: KeyCode
        let pressed: Bool
    }

    public static func keyEvent(
        sequence: UInt64,
        clientTimeMicros: UInt64,
        key: KeyCode,
        pressed: Bool
    ) -> InputFrame {
        InputFrame(
            kind: .keyEvent,
            sequence: sequence,
            clientTimeMicros: clientTimeMicros,
            keyEvent: KeyEvent(key: key, pressed: pressed),
            keys: []
        )
    }

    public static func state(
        sequence: UInt64,
        clientTimeMicros: UInt64,
        keys: [KeyCode]
    ) -> InputFrame {
        InputFrame(
            kind: .state,
            sequence: sequence,
            clientTimeMicros: clientTimeMicros,
            keyEvent: nil,
            keys: Array(keys.prefix(maxKeys))
        )
    }

    public func encode() -> Data {
        var data = Data()
        data.reserveCapacity(20 + keys.count * 2)
        data.append(frameMagic)
        data.append(frameVersion)
        data.append(kind.rawValue)
        data.append(flagsOrCount)
        data.appendLittleEndian(sequence)
        data.appendLittleEndian(clientTimeMicros)

        switch kind {
        case .keyEvent:
            if let keyEvent {
                data.appendLittleEndian(keyEvent.key.wireValue)
            }
        case .state:
            for key in keys {
                data.appendLittleEndian(key.wireValue)
            }
        }

        return data
    }

    private var flagsOrCount: UInt8 {
        switch kind {
        case .keyEvent:
            keyEvent?.pressed == true ? 1 : 0
        case .state:
            UInt8(keys.count)
        }
    }
}

private extension Data {
    mutating func appendLittleEndian(_ value: UInt64) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { bytes in
            append(contentsOf: bytes)
        }
    }

    mutating func appendLittleEndian(_ value: UInt16) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { bytes in
            append(contentsOf: bytes)
        }
    }
}
