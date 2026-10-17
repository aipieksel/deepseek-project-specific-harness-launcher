import AppKit
import SwiftUI

struct ProjectDetailView: View {
    @Binding var project: HarnessProject
    @ObservedObject var registry: ProjectRegistry
    @ObservedObject var launcher: HarnessLauncher

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()

            Form {
                Section("Project") {
                    TextField("Name", text: $project.name)
                        .textFieldStyle(.roundedBorder)

                    HStack {
                        TextField("Path", text: $project.path)
                            .textFieldStyle(.roundedBorder)

                        Button {
                            chooseFolder()
                        } label: {
                            Label("Choose", systemImage: "folder")
                        }

                        Button {
                            NSWorkspace.shared.open(URL(fileURLWithPath: project.path))
                        } label: {
                            Label("Reveal", systemImage: "arrow.up.forward.app")
                        }
                        .disabled(!pathExists)
                    }

                    HStack {
                        TextField("Port", value: $project.port, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 110)

                        Stepper("", value: $project.port, in: 1...65_535)
                            .labelsHidden()

                        Text(pathExists ? "Path exists" : "Path does not exist")
                            .foregroundColor(pathExists ? .secondary : .red)
                    }

                    Toggle(isOn: $project.disableTokenAuth) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Disable token auth")
                            Text("Open http://127.0.0.1:\(project.port)/ without a launch token. Relaunch the project after changing this.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .toggleStyle(.switch)
                }

                Section("Actions") {
                    HStack {
                        Button {
                            registry.save()
                            launcher.launch(project)
                        } label: {
                            Label("Launch", systemImage: "play.fill")
                        }
                        .keyboardShortcut(.return, modifiers: [.command])
                        .disabled(!project.isValid)

                        Button {
                            launcher.stop(project)
                        } label: {
                            Label("Stop", systemImage: "stop.fill")
                        }
                        .disabled(!launcher.isRunning(project))

                        Button {
                            launcher.openBrowser(for: project)
                        } label: {
                            Label("Open", systemImage: "safari")
                        }
                        .disabled(launcher.browserURL(for: project) == nil)

                        Button {
                            registry.createShortcut(for: project)
                        } label: {
                            Label("Shortcut", systemImage: "link")
                        }

                        Spacer()

                        Button(role: .destructive) {
                            registry.deleteSelected()
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }

                Section("Output") {
                    ScrollView {
                        Text(redactedOutput)
                            .font(.system(.caption, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                            .padding(10)
                    }
                    .frame(minHeight: 160)
                    .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
            .padding(20)

            Divider()

            HStack {
                Text(registry.statusMessage)
                Spacer()
                Text(launcher.statusMessage)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: launcher.isRunning(project) ? "play.circle.fill" : "terminal")
                .font(.system(size: 30))
                .foregroundStyle(launcher.isRunning(project) ? .green : .secondary)

            VStack(alignment: .leading, spacing: 3) {
                Text(project.name.isEmpty ? "Untitled Project" : project.name)
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("DeepSeek Harness on port \(project.port)")
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                registry.save()
            } label: {
                Label("Save", systemImage: "square.and.arrow.down")
            }
        }
        .padding(20)
    }

    private var pathExists: Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: project.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }

    private var redactedOutput: String {
        let output = launcher.output(for: project)
        guard !output.isEmpty else { return "Launch output will appear here." }
        return output.replacingOccurrences(
            of: #"token=[A-Za-z0-9_-]+"#,
            with: "token=<redacted>",
            options: .regularExpression
        )
    }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: project.path)

        if panel.runModal() == .OK, let url = panel.url {
            project.path = url.path
        }
    }
}
