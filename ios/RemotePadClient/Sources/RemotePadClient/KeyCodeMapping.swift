import Foundation

private let windowsExtendedScanFlag: UInt16 = 0xFF00

public enum KeyCodeMappingError: Error, Equatable, Sendable {
    case unsupportedLayoutCode(String)
}

public extension KeyCode {
    init(layoutCode: String) throws {
        guard let wireValue = Self.windowsScanCode(for: layoutCode) else {
            throw KeyCodeMappingError.unsupportedLayoutCode(layoutCode)
        }
        try self.init(wireValue: wireValue)
    }

    static func windowsScanCode(for layoutCode: String) -> UInt16? {
        switch layoutCode {
        case "KeyA": 0x1E
        case "KeyB": 0x30
        case "KeyC": 0x2E
        case "KeyD": 0x20
        case "KeyE": 0x12
        case "KeyF": 0x21
        case "KeyG": 0x22
        case "KeyH": 0x23
        case "KeyI": 0x17
        case "KeyJ": 0x24
        case "KeyK": 0x25
        case "KeyL": 0x26
        case "KeyM": 0x32
        case "KeyN": 0x31
        case "KeyO": 0x18
        case "KeyP": 0x19
        case "KeyQ": 0x10
        case "KeyR": 0x13
        case "KeyS": 0x1F
        case "KeyT": 0x14
        case "KeyU": 0x16
        case "KeyV": 0x2F
        case "KeyW": 0x11
        case "KeyX": 0x2D
        case "KeyY": 0x15
        case "KeyZ": 0x2C
        case "Digit0": 0x0B
        case "Digit1": 0x02
        case "Digit2": 0x03
        case "Digit3": 0x04
        case "Digit4": 0x05
        case "Digit5": 0x06
        case "Digit6": 0x07
        case "Digit7": 0x08
        case "Digit8": 0x09
        case "Digit9": 0x0A
        case "Space": 0x39
        case "Enter": 0x1C
        case "Escape": 0x01
        case "Backspace": 0x0E
        case "Tab": 0x0F
        case "ShiftLeft": 0x2A
        case "ShiftRight": 0x36
        case "ControlLeft": 0x1D
        case "ControlRight": windowsExtendedScanFlag | 0x1D
        case "AltLeft": 0x38
        case "AltRight": windowsExtendedScanFlag | 0x38
        case "ArrowUp": windowsExtendedScanFlag | 0x48
        case "ArrowLeft": windowsExtendedScanFlag | 0x4B
        case "ArrowRight": windowsExtendedScanFlag | 0x4D
        case "ArrowDown": windowsExtendedScanFlag | 0x50
        default: nil
        }
    }
}
