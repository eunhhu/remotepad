import Foundation

public struct Layout: Codable, Equatable, Sendable {
    public let canvasSize: CanvasSize
    public let controls: [Control]

    public static func decode(_ data: Data) throws -> Layout {
        try JSONDecoder().decode(Layout.self, from: data)
    }

    public func encode() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }
}

public struct CanvasSize: Codable, Equatable, Sendable {
    public let width: String
    public let height: String
}

public struct Control: Codable, Equatable, Sendable {
    public let type: ControlKind
    public let left: String
    public let top: String
    public let width: String
    public let height: String
    public let borderRadius: String
    public let transform: String
    public let key: String

    private enum CodingKeys: String, CodingKey {
        case type
        case left
        case top
        case width
        case height
        case borderRadius
        case transform
        case key
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(ControlKind.self, forKey: .type)
        left = try container.decode(String.self, forKey: .left)
        top = try container.decode(String.self, forKey: .top)
        width = try container.decode(String.self, forKey: .width)
        height = try container.decode(String.self, forKey: .height)
        borderRadius = try container.decodeIfPresent(String.self, forKey: .borderRadius) ?? ""
        transform = try container.decodeIfPresent(String.self, forKey: .transform) ?? ""
        key = try container.decodeIfPresent(String.self, forKey: .key) ?? ""
    }
}

public enum ControlKind: String, Codable, Equatable, Sendable {
    case Button
    case Joystick
    case MouseZone
}
