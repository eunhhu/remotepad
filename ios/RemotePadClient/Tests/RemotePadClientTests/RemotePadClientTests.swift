import Foundation
import Testing
@testable import RemotePadClient

@Test func decodesExistingLayout() throws {
    let json = """
    {
      "canvasSize": { "width": "915px", "height": "440px" },
      "controls": [
        { "type": "Button", "left": "0px", "top": "0px", "width": "90px", "height": "90px", "borderRadius": "", "transform": "", "key": "KeyA" },
        { "type": "MouseZone", "left": "90px", "top": "0px", "width": "90px", "height": "90px", "borderRadius": "", "transform": "", "key": "" }
      ]
    }
    """

    let layout = try Layout.decode(json.data(using: .utf8)!)

    #expect(layout.canvasSize.width == "915px")
    #expect(layout.controls.count == 2)
}

@Test func encodesTwelveKeyStateFrame() throws {
    let keys = try (0..<12).map { try KeyCode(wireValue: UInt16($0 + 4)) }
    let frame = InputFrame.state(sequence: 7, clientTimeMicros: 1_234, keys: keys)

    let bytes = frame.encode()

    #expect(bytes.count == 44)
    #expect(bytes[0] == 0x52)
    #expect(bytes[1] == 1)
    #expect(bytes[2] == 2)
    #expect(bytes[3] == 12)
    #expect(bytes[4] == 7)
    #expect(bytes[12] == 0xd2)
    #expect(bytes[13] == 0x04)
    #expect(bytes[20] == 4)
    #expect(bytes[42] == 15)
}

@Test func rejectsInvalidKeyCode() {
    #expect(throws: ProtocolEncodingError.self) {
        _ = try KeyCode(wireValue: 0)
    }
}

@Test func decodesServerAcceptedLayoutWhenOptionalStyleFieldsMissing() throws {
    let json = """
    {
      "canvasSize": { "width": "100px", "height": "100px" },
      "controls": [
        { "type": "Button", "left": "0px", "top": "0px", "width": "50px", "height": "50px" }
      ]
    }
    """

    let layout = try Layout.decode(json.data(using: .utf8)!)

    #expect(layout.controls[0].key == "")
    #expect(layout.controls[0].transform == "")
}

@Test func udpSenderBuildsEndpoint() throws {
    let sender = try UdpInputSender(host: "127.0.0.1", port: 3001)
    #expect(sender.endpointDescription.contains("127.0.0.1"))
}
