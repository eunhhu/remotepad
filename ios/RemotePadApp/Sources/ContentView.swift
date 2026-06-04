import SwiftUI

struct ContentView: View {
    @State private var model = RemotePadViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Host", text: $model.host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("UDP Port", text: $model.portText)
                        .keyboardType(.numberPad)
                    Button(model.connected ? "Reconnect UDP" : "Connect UDP") {
                        model.connect()
                    }
                }

                Section("QA Input") {
                    Button("Tap KeyZ") {
                        model.tapKeyZ()
                    }
                    Button("Send 12-key state") {
                        model.sendTwelveKeyState()
                    }
                }

                Section("Status") {
                    Text(model.status)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                }
            }
            .navigationTitle("RemotePad")
        }
    }
}

#Preview {
    ContentView()
}
