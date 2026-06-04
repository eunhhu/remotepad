import SwiftUI
import UIKit

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var model = RemotePadViewModel()
    @State private var showChrome = true
    @State private var showConnectionPanel = true
    @State private var scaleMode = SurfaceScaleMode.fit
    @FocusState private var focusedField: Field?

    var body: some View {
        ZStack {
            if let layout = model.layout {
                runtimeView(layout)
            } else {
                setupView
            }
        }
        .statusBarHidden(model.layout != nil)
        .persistentSystemOverlays(model.layout == nil ? .automatic : .hidden)
        .onChange(of: model.connected) { _, connected in
            if connected {
                focusedField = nil
                showConnectionPanel = false
                showChrome = false
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                model.releaseAll(reason: "scene \(phase)")
            }
        }
    }

    private var setupView: some View {
        NavigationStack {
            VStack(spacing: 0) {
                connectionPanel(material: false)
                Divider()
                ContentUnavailableView("No layout", systemImage: "rectangle.dashed", description: Text("Connect to the RemotePad server."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Divider()
                statusPanel(material: false)
            }
            .navigationTitle("RemotePad")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func runtimeView(_ layout: Layout) -> some View {
        ZStack {
            RemotePadLayoutSurface(layout: layout, model: model, scaleMode: scaleMode)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(count: 2) {
                    withAnimation(.snappy) {
                        showChrome.toggle()
                    }
                }

            if showChrome {
                VStack(spacing: 0) {
                    runtimeToolbar

                    if showConnectionPanel {
                        connectionPanel(material: true)
                            .padding(.horizontal, 12)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    Spacer(minLength: 0)
                    statusPanel(material: true)
                        .padding(.horizontal, 12)
                        .padding(.bottom, 10)
                }
                .padding(.top, 10)
            } else {
                VStack {
                    HStack {
                        runtimeIcon("slider.horizontal.3", "Show controls") {
                            withAnimation(.snappy) {
                                showChrome = true
                            }
                        }
                        Spacer()
                    }
                    .padding(.top, 10)
                    .padding(.horizontal, 12)
                    Spacer()
                }
            }
        }
        .background(Color(.systemBackground))
    }

    private var runtimeToolbar: some View {
        HStack(spacing: 8) {
            runtimeIcon(showConnectionPanel ? "xmark" : "slider.horizontal.3", showConnectionPanel ? "Hide controls" : "Show controls") {
                withAnimation(.snappy) {
                    showConnectionPanel.toggle()
                }
            }

            runtimeIcon("arrow.clockwise", "Reload layout") {
                model.reloadLayout()
            }

            runtimeIcon(scaleMode.systemImage, scaleMode.accessibilityLabel) {
                withAnimation(.snappy) {
                    scaleMode.toggle()
                }
            }

            Spacer()

            runtimeIcon(showChrome ? "eye.slash" : "eye", "Hide overlay") {
                withAnimation(.snappy) {
                    showChrome.toggle()
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private func runtimeIcon(_ systemName: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.body.weight(.semibold))
                .frame(width: 40, height: 40)
        }
        .buttonStyle(.bordered)
        .background(.thinMaterial, in: Circle())
        .clipShape(Circle())
        .accessibilityLabel(label)
    }

    private func connectionPanel(material: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                TextField("Windows IP", text: $model.host)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.numbersAndPunctuation)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .host)
                    .accessibilityLabel("Windows host IP")

                Button {
                    focusedField = nil
                    model.connect()
                } label: {
                    Label(model.connected ? "Reconnect" : "Connect", systemImage: "antenna.radiowaves.left.and.right")
                }
                .buttonStyle(.borderedProminent)
            }

            HStack(spacing: 8) {
                TextField("HTTP", text: $model.httpPortText)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 82)
                    .focused($focusedField, equals: .http)
                    .accessibilityLabel("HTTP port")

                TextField("UDP", text: $model.udpPortText)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 82)
                    .focused($focusedField, equals: .udp)
                    .accessibilityLabel("UDP port")

                Button {
                    model.reloadLayout()
                } label: {
                    Label("Reload", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)

                Button {
                    model.sendTwelveKeyState()
                } label: {
                    Image(systemName: "keyboard")
                        .font(.body.weight(.semibold))
                        .frame(width: 36, height: 24)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Send 12-key state")
            }
        }
        .padding(12)
        .background {
            if material {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.thinMaterial)
            }
        }
    }

    private func statusPanel(material: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.status)
                .font(.footnote.monospaced())
                .textSelection(.enabled)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let stats = model.stats {
                Text("rx \(stats.received) ok \(stats.applied) stale \(stats.stale) drop \(stats.dropped) bad \(stats.malformed)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            if material {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.thinMaterial)
            }
        }
    }
}

private enum Field: Hashable {
    case host
    case http
    case udp
}

private enum SurfaceScaleMode {
    case fit
    case fill

    var systemImage: String {
        switch self {
        case .fit:
            "arrow.up.left.and.arrow.down.right"
        case .fill:
            "rectangle.compress.vertical"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .fit:
            "Use fill mode"
        case .fill:
            "Use fit mode"
        }
    }

    mutating func toggle() {
        self = self == .fit ? .fill : .fit
    }
}

private struct RemotePadLayoutSurface: View {
    let layout: Layout
    let model: RemotePadViewModel
    let scaleMode: SurfaceScaleMode

    var body: some View {
        RemotePadTouchSurface(layout: layout, scaleMode: scaleMode) { control in
            model.press(control)
        } onRelease: { control in
            model.release(control)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct RemotePadTouchSurface: UIViewRepresentable {
    let layout: Layout
    let scaleMode: SurfaceScaleMode
    let onPress: (Control) -> Void
    let onRelease: (Control) -> Void

    func makeUIView(context: Context) -> RemotePadTouchSurfaceView {
        RemotePadTouchSurfaceView()
    }

    func updateUIView(_ uiView: RemotePadTouchSurfaceView, context: Context) {
        uiView.configure(
            layout: layout,
            scaleMode: scaleMode,
            onPress: onPress,
            onRelease: onRelease
        )
    }
}

private final class RemotePadTouchSurfaceView: UIView {
    private var currentLayout: Layout?
    private var scaleMode = SurfaceScaleMode.fit
    private var controlRects: [(control: Control, rect: CGRect)] = []
    private var activeTouches: [ObjectIdentifier: Control] = [:]
    private var onPress: (Control) -> Void = { _ in }
    private var onRelease: (Control) -> Void = { _ in }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isMultipleTouchEnabled = true
        isOpaque = true
        backgroundColor = .systemBackground
        isAccessibilityElement = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(
        layout: Layout,
        scaleMode: SurfaceScaleMode,
        onPress: @escaping (Control) -> Void,
        onRelease: @escaping (Control) -> Void
    ) {
        let changed = currentLayout != layout || self.scaleMode != scaleMode
        currentLayout = layout
        self.scaleMode = scaleMode
        self.onPress = onPress
        self.onRelease = onRelease
        if changed {
            rebuildControlRects()
            setNeedsDisplay()
            updateAccessibilityElements()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        rebuildControlRects()
        setNeedsDisplay()
        updateAccessibilityElements()
    }

    override func draw(_ rect: CGRect) {
        guard let layout = currentLayout else {
            UIColor.systemBackground.setFill()
            UIRectFill(rect)
            return
        }

        UIColor.systemBackground.setFill()
        UIRectFill(rect)

        let canvasRect = canvasFrame(for: layout)
        let canvasPath = UIBezierPath(roundedRect: canvasRect, cornerRadius: 8)
        UIColor.secondarySystemBackground.setFill()
        canvasPath.fill()
        UIColor.separator.setStroke()
        canvasPath.lineWidth = 1
        canvasPath.stroke()

        for item in controlRects {
            drawControl(item.control, in: item.rect)
        }
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            assign(touch, to: control(at: touch.location(in: self)))
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            assign(touch, to: control(at: touch.location(in: self)))
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        release(touches)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        release(touches)
    }

    private func assign(_ touch: UITouch, to nextControl: Control?) {
        let touchId = ObjectIdentifier(touch)
        let currentControl = activeTouches[touchId]
        if currentControl == nextControl {
            return
        }
        if let currentControl {
            onRelease(currentControl)
            activeTouches.removeValue(forKey: touchId)
        }
        if let nextControl {
            activeTouches[touchId] = nextControl
            onPress(nextControl)
        }
    }

    private func release(_ touches: Set<UITouch>) {
        for touch in touches {
            let touchId = ObjectIdentifier(touch)
            if let control = activeTouches.removeValue(forKey: touchId) {
                onRelease(control)
            }
        }
    }

    private func control(at point: CGPoint) -> Control? {
        controlRects
            .reversed()
            .first { item in
                item.control.type == .Button
                    && !item.control.key.isEmpty
                    && item.rect.contains(point)
            }?
            .control
    }

    private func rebuildControlRects() {
        guard let layout = currentLayout else {
            controlRects = []
            return
        }
        let scale = canvasScale(for: layout)
        let canvasRect = canvasFrame(for: layout)
        controlRects = layout.controls.map { control in
            (
                control,
                CGRect(
                    x: canvasRect.minX + pixels(control.left, fallback: 0) * scale,
                    y: canvasRect.minY + pixels(control.top, fallback: 0) * scale,
                    width: pixels(control.width, fallback: 88) * scale,
                    height: pixels(control.height, fallback: 88) * scale
                )
            )
        }
    }

    private func canvasFrame(for layout: Layout) -> CGRect {
        let canvasWidth = pixels(layout.canvasSize.width, fallback: 820)
        let canvasHeight = pixels(layout.canvasSize.height, fallback: 420)
        let scale = canvasScale(for: layout)
        let scaledSize = CGSize(width: canvasWidth * scale, height: canvasHeight * scale)
        return CGRect(
            x: (bounds.width - scaledSize.width) / 2,
            y: (bounds.height - scaledSize.height) / 2,
            width: scaledSize.width,
            height: scaledSize.height
        )
    }

    private func canvasScale(for layout: Layout) -> CGFloat {
        let canvasWidth = pixels(layout.canvasSize.width, fallback: 820)
        let canvasHeight = pixels(layout.canvasSize.height, fallback: 420)
        guard canvasWidth > 0, canvasHeight > 0, bounds.width > 0, bounds.height > 0 else {
            return 1
        }
        let widthScale = bounds.width / canvasWidth
        let heightScale = bounds.height / canvasHeight
        return max(0.1, scaleMode == .fit ? min(widthScale, heightScale) : max(widthScale, heightScale))
    }

    private func drawControl(_ control: Control, in rect: CGRect) {
        let isButton = control.type == .Button
        let radius = min(pixels(control.borderRadius, fallback: 14), min(rect.width, rect.height) / 2)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: radius)
        (isButton ? UIColor.systemBlue.withAlphaComponent(0.78) : UIColor.systemGray.withAlphaComponent(0.24)).setFill()
        path.fill()
        (isButton ? UIColor.systemBlue : UIColor.systemGray.withAlphaComponent(0.5)).setStroke()
        path.lineWidth = 1
        path.stroke()

        let title = controlTitle(control)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let fontSize = max(11, min(24, rect.height * 0.32))
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: fontSize, weight: .semibold),
            .foregroundColor: isButton ? UIColor.white : UIColor.secondaryLabel,
            .paragraphStyle: paragraphStyle,
        ]
        let textRect = rect.insetBy(dx: 4, dy: max(0, (rect.height - fontSize * 1.3) / 2))
        title.draw(
            with: textRect,
            options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
            attributes: attributes,
            context: nil
        )
    }

    private func updateAccessibilityElements() {
        accessibilityElements = controlRects.map { item in
            let element = UIAccessibilityElement(accessibilityContainer: self)
            element.accessibilityLabel = item.control.key.isEmpty ? item.control.type.rawValue : item.control.key
            element.accessibilityTraits = item.control.type == .Button ? [.button] : []
            element.accessibilityFrameInContainerSpace = item.rect
            return element
        }
    }
}

private func controlTitle(_ control: Control) -> String {
    switch control.key {
    case "ArrowUp":
        return "↑"
    case "ArrowLeft":
        return "←"
    case "ArrowRight":
        return "→"
    case "ArrowDown":
        return "↓"
    case let key where key.hasPrefix("Key") && key.count == 4:
        return String(key.suffix(1))
    default:
        return control.key.isEmpty ? control.type.rawValue : control.key
    }
}

private func pixels(_ value: String, fallback: CGFloat) -> CGFloat {
    let trimmed = value
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "px", with: "")
    guard let parsed = Double(trimmed), parsed.isFinite else {
        return fallback
    }
    return CGFloat(parsed)
}

#Preview {
    ContentView()
}
