import Dispatch
import Foundation
import Network

public enum UdpInputSenderError: Error, Equatable, Sendable {
    case invalidPort(UInt16)
}

public final class UdpInputSender: @unchecked Sendable {
    private let connection: NWConnection
    public let endpointDescription: String

    public init(host: String, port: UInt16) throws {
        guard let endpointPort = NWEndpoint.Port(rawValue: port) else {
            throw UdpInputSenderError.invalidPort(port)
        }
        let endpointHost = NWEndpoint.Host(host)
        connection = NWConnection(host: endpointHost, port: endpointPort, using: .udp)
        endpointDescription = "\(host):\(port)"
    }

    public func start(queue: DispatchQueue = .global(qos: .userInteractive)) {
        connection.start(queue: queue)
    }

    public func cancel() {
        connection.cancel()
    }

    public func send(_ frame: InputFrame, completion: @escaping @Sendable (NWError?) -> Void) {
        connection.send(
            content: frame.encode(),
            completion: .contentProcessed { error in
                completion(error)
            }
        )
    }
}
