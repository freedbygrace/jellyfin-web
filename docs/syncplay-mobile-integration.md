# SyncPlay Enhancements - Mobile App Integration Guide

This guide provides integration instructions for iOS and Android Jellyfin clients to implement the SyncPlay enhancements (Phases 1-3).

## Table of Contents

- [Overview](#overview)
- [iOS Integration (Swift)](#ios-integration-swift)
- [Android Integration (Kotlin)](#android-integration-kotlin)
- [Cross-Platform Considerations](#cross-platform-considerations)
- [Testing](#testing)

## Overview

### Mobile-Specific Considerations

1. **Screen Real Estate**: Limited space requires collapsible/tabbed UI
2. **Touch Targets**: Minimum 44pt/48dp touch targets
3. **Network Efficiency**: Optimize WebSocket reconnection on network changes
4. **Background Handling**: Manage WebSocket when app backgrounds
5. **Notifications**: Use local notifications for important events
6. **Performance**: Lazy loading and efficient list rendering

### Architecture Pattern

Both iOS and Android should follow similar patterns:
- **Model Layer**: Data models matching API DTOs
- **Network Layer**: API client and WebSocket handler
- **ViewModel/Presenter**: Business logic and state management
- **View Layer**: UI components

## iOS Integration (Swift)

### Prerequisites

- Xcode 14+
- Swift 5.7+
- iOS 14+ target
- Existing Jellyfin iOS app codebase

### Step 1: Define Data Models

Create `Models/SyncPlay/SyncPlayModels.swift`:

```swift
import Foundation

// MARK: - Phase 1: Member Information

struct GroupMemberInfo: Codable, Identifiable {
    let userId: String
    let userName: String
    let ping: Int
    let isBuffering: Bool
    let isReady: Bool
    
    var id: String { userId }
    
    enum CodingKeys: String, CodingKey {
        case userId, userName, ping, isBuffering, isReady
    }
}

struct GroupInfo: Codable, Identifiable {
    let groupId: String
    let groupName: String
    let state: String
    let participants: [String]
    let lastUpdatedAt: String
    let members: [GroupMemberInfo]
    
    var id: String { groupId }
    
    enum CodingKeys: String, CodingKey {
        case groupId, groupName, state, participants, lastUpdatedAt, members
    }
}

// MARK: - Phase 2: Chat Messages

struct ChatMessage: Codable, Identifiable {
    let messageId: String
    let groupId: String
    let userId: String
    let userName: String
    let message: String
    let timestamp: String
    let isSystemMessage: Bool
    
    var id: String { messageId }
    
    var date: Date {
        ISO8601DateFormatter().date(from: timestamp) ?? Date()
    }
    
    enum CodingKeys: String, CodingKey {
        case messageId, groupId, userId, userName, message, timestamp, isSystemMessage
    }
}

struct SendChatMessageRequest: Codable {
    let message: String
}

// MARK: - Phase 3: Lobby & Ready

struct SetReadyRequest: Codable {
    let isReady: Bool
}

struct ReadyUpdate: Codable {
    let userId: String
    let userName: String
    let isReady: Bool
    let allReady: Bool
}

// MARK: - WebSocket Updates

enum GroupUpdateType: String, Codable {
    case chatMessage = "ChatMessage"
    case userReady = "UserReady"
    // ... other existing types
}

struct GroupUpdate<T: Codable>: Codable {
    let groupId: String
    let type: GroupUpdateType
    let data: T
}
```

### Step 2: Create API Client Extension

Create `Services/SyncPlay/SyncPlayAPI.swift`:

```swift
import Foundation

extension JellyfinAPI {
    
    // MARK: - Phase 1: Group Information
    
    func getGroupInfo(groupId: String? = nil) async throws -> GroupInfo {
        let endpoint = groupId != nil ? "/SyncPlay/\(groupId!)" : "/SyncPlay/List"
        return try await get(endpoint)
    }
    
    func getGroupMembers(groupId: String) async throws -> [GroupMemberInfo] {
        return try await get("/SyncPlay/\(groupId)/Members")
    }
    
    // MARK: - Phase 2: Chat
    
    func sendChatMessage(_ message: String) async throws {
        let request = SendChatMessageRequest(message: message)
        try await post("/SyncPlay/Chat", body: request)
    }
    
    func getChatHistory() async throws -> [ChatMessage] {
        return try await get("/SyncPlay/Chat")
    }
    
    // MARK: - Phase 3: Lobby & Ready
    
    func setLobbyReady(_ isReady: Bool) async throws {
        let request = SetReadyRequest(isReady: isReady)
        try await post("/SyncPlay/LobbyReady", body: request)
    }
}
```

### Step 3: Create WebSocket Handler

Create `Services/SyncPlay/SyncPlayWebSocketManager.swift`:

```swift
import Foundation
import Combine

class SyncPlayWebSocketManager: ObservableObject {
    @Published var isConnected = false
    @Published var chatMessages: [ChatMessage] = []
    @Published var groupInfo: GroupInfo?
    
    private var webSocket: URLSessionWebSocketTask?
    private var cancellables = Set<AnyCancellable>()
    
    func connect(serverURL: URL, accessToken: String) {
        var components = URLComponents(url: serverURL, resolvingAgainstBaseURL: false)
        components?.scheme = serverURL.scheme == "https" ? "wss" : "ws"
        components?.path = "/socket"
        components?.queryItems = [URLQueryItem(name: "api_key", value: accessToken)]
        
        guard let wsURL = components?.url else { return }
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: wsURL)
        webSocket?.resume()
        
        isConnected = true
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage() // Continue receiving
                
            case .failure(let error):
                print("WebSocket error: \(error)")
                self?.isConnected = false
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        
        do {
            let decoder = JSONDecoder()
            
            // Try to decode as chat message update
            if let chatUpdate = try? decoder.decode(GroupUpdate<ChatMessage>.self, from: data),
               chatUpdate.type == .chatMessage {
                DispatchQueue.main.async {
                    self.chatMessages.append(chatUpdate.data)
                }
                return
            }
            
            // Try to decode as ready update
            if let readyUpdate = try? decoder.decode(GroupUpdate<ReadyUpdate>.self, from: data),
               readyUpdate.type == .userReady {
                DispatchQueue.main.async {
                    self.updateMemberReady(readyUpdate.data)
                    
                    if readyUpdate.data.allReady {
                        self.notifyAllReady()
                    }
                }
                return
            }
        }
    }
    
    private func updateMemberReady(_ update: ReadyUpdate) {
        guard var group = groupInfo else { return }
        
        group.members = group.members.map { member in
            var updatedMember = member
            if member.userId == update.userId {
                updatedMember.isReady = update.isReady
            }
            return updatedMember
        }
        
        groupInfo = group
    }
    
    private func notifyAllReady() {
        // Show local notification
        let content = UNMutableNotificationContent()
        content.title = "SyncPlay"
        content.body = "Everyone is ready!"
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        isConnected = false
    }
}
```

### Step 4: Create SwiftUI Views

Create `Views/SyncPlay/MemberListView.swift`:

```swift
import SwiftUI

struct MemberListView: View {
    let members: [GroupMemberInfo]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Members (\(members.count))")
                .font(.headline)
                .padding(.horizontal)
            
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(members) { member in
                        MemberCardView(member: member)
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}

struct MemberCardView: View {
    let member: GroupMemberInfo
    
    var pingColor: Color {
        switch member.ping {
        case 0..<50: return .green
        case 50..<100: return .yellow
        case 100..<200: return .orange
        default: return .red
        }
    }
    
    var pingLabel: String {
        switch member.ping {
        case 0..<50: return "Excellent"
        case 50..<100: return "Good"
        case 100..<200: return "Fair"
        default: return "Poor"
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Ready indicator
            Image(systemName: member.isReady ? "checkmark.circle.fill" : "circle")
                .foregroundColor(member.isReady ? .green : .gray)
                .font(.title2)
            
            // Member name
            VStack(alignment: .leading, spacing: 4) {
                Text(member.userName)
                    .font(.headline)
                
                HStack(spacing: 12) {
                    Label(
                        member.isReady ? "Ready" : "Not Ready",
                        systemImage: member.isReady ? "checkmark" : "xmark"
                    )
                    .font(.caption)
                    .foregroundColor(member.isReady ? .green : .gray)
                    
                    Label(
                        member.isBuffering ? "Buffering" : "Playing",
                        systemImage: member.isBuffering ? "arrow.clockwise" : "play.fill"
                    )
                    .font(.caption)
                    .foregroundColor(member.isBuffering ? .orange : .green)
                }
            }
            
            Spacer()
            
            // Ping badge
            VStack(spacing: 2) {
                Text("\(member.ping)ms")
                    .font(.caption)
                    .fontWeight(.semibold)
                Text(pingLabel)
                    .font(.caption2)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(pingColor.opacity(0.2))
            .foregroundColor(pingColor)
            .cornerRadius(8)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

Create `Views/SyncPlay/ChatView.swift`:

```swift
import SwiftUI

struct ChatView: View {
    @Binding var messages: [ChatMessage]
    @State private var inputText = ""
    let currentUserId: String
    let onSendMessage: (String) -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messages) { message in
                            ChatMessageView(
                                message: message,
                                isOwnMessage: message.userId == currentUserId
                            )
                            .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _ in
                    if let lastMessage = messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            Divider()
            
            // Input field
            HStack(spacing: 12) {
                TextField("Type a message...", text: $inputText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding(10)
                        .background(Color.blue)
                        .clipShape(Circle())
                }
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
        }
    }
    
    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        
        onSendMessage(trimmed)
        inputText = ""
    }
}

struct ChatMessageView: View {
    let message: ChatMessage
    let isOwnMessage: Bool
    
    var body: some View {
        HStack {
            if isOwnMessage { Spacer() }
            
            if message.isSystemMessage {
                // System message
                Text(message.message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.systemGray5))
                    .cornerRadius(12)
            } else {
                // User message
                VStack(alignment: isOwnMessage ? .trailing : .leading, spacing: 4) {
                    if !isOwnMessage {
                        Text(message.userName)
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    
                    Text(message.message)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(isOwnMessage ? Color.blue : Color(.systemGray5))
                        .foregroundColor(isOwnMessage ? .white : .primary)
                        .cornerRadius(16)
                    
                    Text(message.date, style: .time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            if !isOwnMessage { Spacer() }
        }
    }
}
```

Create `Views/SyncPlay/LobbyView.swift`:

```swift
import SwiftUI

struct LobbyView: View {
    let group: GroupInfo
    let currentUserId: String
    let onToggleReady: (Bool) -> Void
    let onStartPlayback: () -> Void

    private var currentMember: GroupMemberInfo? {
        group.members.first { $0.userId == currentUserId }
    }

    private var isReady: Bool {
        currentMember?.isReady ?? false
    }

    private var readyCount: Int {
        group.members.filter { $0.isReady }.count
    }

    private var allReady: Bool {
        !group.members.isEmpty && readyCount == group.members.count
    }

    var body: some View {
        VStack(spacing: 24) {
            // Header
            Text(group.groupName)
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Lobby")
                .font(.title2)
                .foregroundColor(.secondary)

            // Progress
            VStack(spacing: 12) {
                Text("Ready: \(readyCount)/\(group.members.count)")
                    .font(.headline)

                ProgressView(value: Double(readyCount), total: Double(group.members.count))
                    .tint(.green)
            }
            .padding()

            // Member list
            VStack(alignment: .leading, spacing: 8) {
                ForEach(group.members) { member in
                    HStack {
                        Image(systemName: member.isReady ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(member.isReady ? .green : .gray)

                        Text(member.userName)
                            .font(.body)

                        if !member.isReady {
                            Text("(waiting...)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
            }
            .padding()

            Spacer()

            // Ready button
            Button(action: { onToggleReady(!isReady) }) {
                HStack {
                    Image(systemName: isReady ? "checkmark.circle.fill" : "circle")
                    Text(isReady ? "Ready" : "Mark Ready")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isReady ? Color.green : Color.blue)
                .cornerRadius(12)
            }
            .padding(.horizontal)

            // Start button (only when all ready)
            if allReady {
                VStack(spacing: 12) {
                    Text("Everyone is ready!")
                        .font(.headline)
                        .foregroundColor(.green)

                    Button(action: onStartPlayback) {
                        Text("Start Playback")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .cornerRadius(12)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(12)
                .padding(.horizontal)
            }
        }
        .padding()
    }
}
```

## Android Integration (Kotlin)

### Prerequisites

- Android Studio Arctic Fox+
- Kotlin 1.7+
- Android SDK 24+ (Android 7.0+)
- Existing Jellyfin Android app codebase

### Step 1: Define Data Models

Create `models/syncplay/SyncPlayModels.kt`:

```kotlin
package org.jellyfin.mobile.models.syncplay

import kotlinx.serialization.Serializable

// Phase 1: Member Information
@Serializable
data class GroupMemberInfo(
    val userId: String,
    val userName: String,
    val ping: Int,
    val isBuffering: Boolean,
    val isReady: Boolean
)

@Serializable
data class GroupInfo(
    val groupId: String,
    val groupName: String,
    val state: String,
    val participants: List<String>,
    val lastUpdatedAt: String,
    val members: List<GroupMemberInfo>
)

// Phase 2: Chat Messages
@Serializable
data class ChatMessage(
    val messageId: String,
    val groupId: String,
    val userId: String,
    val userName: String,
    val message: String,
    val timestamp: String,
    val isSystemMessage: Boolean
)

@Serializable
data class SendChatMessageRequest(
    val message: String
)

// Phase 3: Lobby & Ready
@Serializable
data class SetReadyRequest(
    val isReady: Boolean
)

@Serializable
data class ReadyUpdate(
    val userId: String,
    val userName: String,
    val isReady: Boolean,
    val allReady: Boolean
)

// WebSocket Updates
enum class GroupUpdateType {
    ChatMessage,
    UserReady
}

@Serializable
data class GroupUpdate<T>(
    val groupId: String,
    val type: String,
    val data: T
)
```

### Step 2: Create API Client Extension

Create `api/SyncPlayApi.kt`:

```kotlin
package org.jellyfin.mobile.api

import io.ktor.client.*
import io.ktor.client.request.*
import org.jellyfin.mobile.models.syncplay.*

class SyncPlayApi(private val client: HttpClient, private val baseUrl: String) {

    // Phase 1: Group Information
    suspend fun getGroupInfo(groupId: String? = null): GroupInfo {
        val endpoint = groupId?.let { "/SyncPlay/$it" } ?: "/SyncPlay/List"
        return client.get("$baseUrl$endpoint")
    }

    suspend fun getGroupMembers(groupId: String): List<GroupMemberInfo> {
        return client.get("$baseUrl/SyncPlay/$groupId/Members")
    }

    // Phase 2: Chat
    suspend fun sendChatMessage(message: String) {
        client.post("$baseUrl/SyncPlay/Chat") {
            setBody(SendChatMessageRequest(message))
        }
    }

    suspend fun getChatHistory(): List<ChatMessage> {
        return client.get("$baseUrl/SyncPlay/Chat")
    }

    // Phase 3: Lobby & Ready
    suspend fun setLobbyReady(isReady: Boolean) {
        client.post("$baseUrl/SyncPlay/LobbyReady") {
            setBody(SetReadyRequest(isReady))
        }
    }
}
```

### Step 3: Create WebSocket Manager

Create `websocket/SyncPlayWebSocketManager.kt`:

```kotlin
package org.jellyfin.mobile.websocket

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import okhttp3.*
import org.jellyfin.mobile.models.syncplay.*

class SyncPlayWebSocketManager(
    private val json: Json
) {
    private var webSocket: WebSocket? = null
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages

    private val _groupInfo = MutableStateFlow<GroupInfo?>(null)
    val groupInfo: StateFlow<GroupInfo?> = _groupInfo

    fun connect(serverUrl: String, accessToken: String) {
        val wsUrl = serverUrl.replace("http", "ws") + "/socket?api_key=$accessToken"

        val client = OkHttpClient()
        val request = Request.Builder()
            .url(wsUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
            }
        })
    }

    private fun handleMessage(text: String) {
        try {
            // Try to parse as chat message
            val chatUpdate = json.decodeFromString<GroupUpdate<ChatMessage>>(text)
            if (chatUpdate.type == "ChatMessage") {
                _chatMessages.value = _chatMessages.value + chatUpdate.data
                return
            }
        } catch (e: Exception) {
            // Not a chat message
        }

        try {
            // Try to parse as ready update
            val readyUpdate = json.decodeFromString<GroupUpdate<ReadyUpdate>>(text)
            if (readyUpdate.type == "UserReady") {
                updateMemberReady(readyUpdate.data)

                if (readyUpdate.data.allReady) {
                    notifyAllReady()
                }
                return
            }
        } catch (e: Exception) {
            // Not a ready update
        }
    }

    private fun updateMemberReady(update: ReadyUpdate) {
        val currentGroup = _groupInfo.value ?: return

        val updatedMembers = currentGroup.members.map { member ->
            if (member.userId == update.userId) {
                member.copy(isReady = update.isReady)
            } else {
                member
            }
        }

        _groupInfo.value = currentGroup.copy(members = updatedMembers)
    }

    private fun notifyAllReady() {
        // Show notification
        // Implementation depends on your notification system
    }

    fun disconnect() {
        webSocket?.close(1000, "User disconnected")
        _isConnected.value = false
    }
}
```

### Step 4: Create Jetpack Compose UI

Create `ui/syncplay/MemberListScreen.kt`:

```kotlin
package org.jellyfin.mobile.ui.syncplay

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.jellyfin.mobile.models.syncplay.GroupMemberInfo

@Composable
fun MemberListScreen(members: List<GroupMemberInfo>) {
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = "Members (${members.size})",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(16.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(members) { member ->
                MemberCard(member = member)
            }
        }
    }
}

@Composable
fun MemberCard(member: GroupMemberInfo) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ready indicator
            Icon(
                imageVector = if (member.isReady)
                    Icons.Default.CheckCircle
                else
                    Icons.Default.Circle,
                contentDescription = if (member.isReady) "Ready" else "Not Ready",
                tint = if (member.isReady) Color.Green else Color.Gray,
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Member info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = member.userName,
                    style = MaterialTheme.typography.titleMedium
                )

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = if (member.isReady) "✓ Ready" else "○ Not Ready",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (member.isReady) Color.Green else Color.Gray
                    )

                    Text(
                        text = if (member.isBuffering) "⟳ Buffering" else "✓ Playing",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (member.isBuffering) Color(0xFFFF9800) else Color.Green
                    )
                }
            }

            // Ping badge
            PingBadge(ping = member.ping)
        }
    }
}

@Composable
fun PingBadge(ping: Int) {
    val (color, label) = when {
        ping < 50 -> Color(0xFF4CAF50) to "Excellent"
        ping < 100 -> Color(0xFFFFEB3B) to "Good"
        ping < 200 -> Color(0xFFFF9800) to "Fair"
        else -> Color(0xFFF44336) to "Poor"
    }

    Surface(
        color = color.copy(alpha = 0.2f),
        shape = MaterialTheme.shapes.small
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "${ping}ms",
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}
```

Create `ui/syncplay/ChatScreen.kt`:

```kotlin
package org.jellyfin.mobile.ui.syncplay

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.jellyfin.mobile.models.syncplay.ChatMessage
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ChatScreen(
    messages: List<ChatMessage>,
    currentUserId: String,
    onSendMessage: (String) -> Unit
) {
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // Auto-scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            coroutineScope.launch {
                listState.animateScrollToItem(messages.size - 1)
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Messages list
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { message ->
                ChatMessageItem(
                    message = message,
                    isOwnMessage = message.userId == currentUserId
                )
            }
        }

        Divider()

        // Input field
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Type a message...") },
                singleLine = true
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        onSendMessage(inputText.trim())
                        inputText = ""
                    }
                },
                enabled = inputText.isNotBlank()
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = if (inputText.isNotBlank())
                        MaterialTheme.colorScheme.primary
                    else
                        Color.Gray
                )
            }
        }
    }
}

@Composable
fun ChatMessageItem(message: ChatMessage, isOwnMessage: Boolean) {
    val dateFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val time = remember(message.timestamp) {
        try {
            val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                .parse(message.timestamp)
            dateFormat.format(date ?: Date())
        } catch (e: Exception) {
            ""
        }
    }

    if (message.isSystemMessage) {
        // System message
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = message.message,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
    } else {
        // User message
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = if (isOwnMessage)
                Arrangement.End
            else
                Arrangement.Start
        ) {
            Surface(
                color = if (isOwnMessage)
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.widthIn(max = 280.dp)
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    if (!isOwnMessage) {
                        Text(
                            text = message.userName,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isOwnMessage)
                                Color.White.copy(alpha = 0.7f)
                            else
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    Text(
                        text = message.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isOwnMessage) Color.White else Color.Unspecified
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = time,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isOwnMessage)
                            Color.White.copy(alpha = 0.7f)
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}
```

Create `ui/syncplay/LobbyScreen.kt`:

```kotlin
package org.jellyfin.mobile.ui.syncplay

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.jellyfin.mobile.models.syncplay.GroupInfo

@Composable
fun LobbyScreen(
    group: GroupInfo,
    currentUserId: String,
    onToggleReady: (Boolean) -> Unit,
    onStartPlayback: () -> Unit
) {
    val currentMember = group.members.find { it.userId == currentUserId }
    val isReady = currentMember?.isReady ?: false
    val readyCount = group.members.count { it.isReady }
    val totalCount = group.members.size
    val allReady = totalCount > 0 && readyCount == totalCount

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Text(
            text = group.groupName,
            style = MaterialTheme.typography.headlineLarge,
            textAlign = TextAlign.Center
        )

        Text(
            text = "Lobby",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Progress
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Ready: $readyCount/$totalCount",
                    style = MaterialTheme.typography.titleMedium
                )

                Spacer(modifier = Modifier.height(12.dp))

                LinearProgressIndicator(
                    progress = if (totalCount > 0) readyCount.toFloat() / totalCount else 0f,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp),
                    color = Color.Green
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Member list
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(group.members) { member ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (member.isReady)
                                Icons.Default.CheckCircle
                            else
                                Icons.Default.Circle,
                            contentDescription = null,
                            tint = if (member.isReady) Color.Green else Color.Gray,
                            modifier = Modifier.size(24.dp)
                        )

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(
                            text = member.userName,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f)
                        )

                        if (!member.isReady) {
                            Text(
                                text = "(waiting...)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Ready button
        Button(
            onClick = { onToggleReady(!isReady) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isReady) Color.Green else MaterialTheme.colorScheme.primary
            )
        ) {
            Icon(
                imageVector = if (isReady) Icons.Default.CheckCircle else Icons.Default.Circle,
                contentDescription = null
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isReady) "Ready" else "Mark Ready",
                style = MaterialTheme.typography.titleMedium
            )
        }

        // Start button (only when all ready)
        if (allReady) {
            Spacer(modifier = Modifier.height(16.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Green.copy(alpha = 0.1f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Everyone is ready!",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.Green
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = onStartPlayback,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.Green
                        )
                    ) {
                        Text(
                            text = "Start Playback",
                            style = MaterialTheme.typography.titleLarge
                        )
                    }
                }
            }
        }
    }
}
```

## Cross-Platform Considerations

### Network Handling

Both platforms should handle:

1. **Connection Loss**: Automatic reconnection with exponential backoff
2. **Background/Foreground**: Disconnect WebSocket when backgrounded, reconnect when foregrounded
3. **Network Changes**: Detect WiFi/cellular changes and reconnect

**iOS Example**:
```swift
import Network

class NetworkMonitor {
    private let monitor = NWPathMonitor()

    func startMonitoring(onNetworkChange: @escaping (Bool) -> Void) {
        monitor.pathUpdateHandler = { path in
            onNetworkChange(path.status == .satisfied)
        }
        monitor.start(queue: DispatchQueue.global())
    }
}
```

**Android Example**:
```kotlin
class NetworkMonitor(context: Context) {
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    fun startMonitoring(onNetworkChange: (Boolean) -> Unit) {
        val networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                onNetworkChange(true)
            }

            override fun onLost(network: Network) {
                onNetworkChange(false)
            }
        }

        connectivityManager.registerDefaultNetworkCallback(networkCallback)
    }
}
```

### Lifecycle Management

**iOS (SwiftUI)**:
```swift
struct SyncPlayView: View {
    @StateObject private var wsManager = SyncPlayWebSocketManager()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        // ... UI code
        .onChange(of: scenePhase) { newPhase in
            switch newPhase {
            case .active:
                wsManager.connect(serverURL: serverURL, accessToken: token)
            case .background:
                wsManager.disconnect()
            default:
                break
            }
        }
    }
}
```

**Android (Jetpack Compose)**:
```kotlin
@Composable
fun SyncPlayScreen(viewModel: SyncPlayViewModel) {
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> viewModel.connectWebSocket()
                Lifecycle.Event.ON_PAUSE -> viewModel.disconnectWebSocket()
                else -> {}
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // ... UI code
}
```

### Notifications

**iOS**:
```swift
import UserNotifications

func requestNotificationPermission() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
        print("Notification permission: \(granted)")
    }
}

func showNotification(title: String, body: String) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default

    let request = UNNotificationRequest(
        identifier: UUID().uuidString,
        content: content,
        trigger: nil
    )

    UNUserNotificationCenter.current().add(request)
}
```

**Android**:
```kotlin
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat

fun createNotificationChannel(context: Context) {
    val channel = NotificationChannel(
        "syncplay",
        "SyncPlay",
        NotificationManager.IMPORTANCE_DEFAULT
    )

    val notificationManager = context.getSystemService(NotificationManager::class.java)
    notificationManager.createNotificationChannel(channel)
}

fun showNotification(context: Context, title: String, message: String) {
    val notification = NotificationCompat.Builder(context, "syncplay")
        .setContentTitle(title)
        .setContentText(message)
        .setSmallIcon(R.drawable.ic_notification)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .build()

    val notificationManager = context.getSystemService(NotificationManager::class.java)
    notificationManager.notify(1, notification)
}
```

## Testing

### Unit Tests

**iOS (XCTest)**:
```swift
import XCTest
@testable import JellyfinMobile

class SyncPlayTests: XCTestCase {
    func testGroupMemberInfoDecoding() throws {
        let json = """
        {
            "userId": "123",
            "userName": "TestUser",
            "ping": 45,
            "isBuffering": false,
            "isReady": true
        }
        """

        let data = json.data(using: .utf8)!
        let member = try JSONDecoder().decode(GroupMemberInfo.self, from: data)

        XCTAssertEqual(member.userId, "123")
        XCTAssertEqual(member.userName, "TestUser")
        XCTAssertEqual(member.ping, 45)
        XCTAssertFalse(member.isBuffering)
        XCTAssertTrue(member.isReady)
    }
}
```

**Android (JUnit)**:
```kotlin
import org.junit.Test
import org.junit.Assert.*
import kotlinx.serialization.json.Json

class SyncPlayTests {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `test GroupMemberInfo deserialization`() {
        val jsonString = """
        {
            "userId": "123",
            "userName": "TestUser",
            "ping": 45,
            "isBuffering": false,
            "isReady": true
        }
        """

        val member = json.decodeFromString<GroupMemberInfo>(jsonString)

        assertEquals("123", member.userId)
        assertEquals("TestUser", member.userName)
        assertEquals(45, member.ping)
        assertFalse(member.isBuffering)
        assertTrue(member.isReady)
    }
}
```

### Integration Tests

Test the full flow with a mock server or the actual Jellyfin server running on localhost.

## Summary

### Implementation Checklist

**iOS**:
- [ ] Add data models to project
- [ ] Extend API client with new endpoints
- [ ] Implement WebSocket manager
- [ ] Create SwiftUI views (MemberList, Chat, Lobby)
- [ ] Add lifecycle management
- [ ] Implement notification handling
- [ ] Add network monitoring
- [ ] Write unit tests
- [ ] Test with server

**Android**:
- [ ] Add data models with kotlinx.serialization
- [ ] Extend API client with new endpoints
- [ ] Implement WebSocket manager with OkHttp
- [ ] Create Jetpack Compose screens
- [ ] Add lifecycle management
- [ ] Implement notification handling
- [ ] Add network monitoring
- [ ] Write unit tests
- [ ] Test with server

### Resources

- [iOS Jellyfin Client](https://github.com/jellyfin/jellyfin-expo)
- [Android Jellyfin Client](https://github.com/jellyfin/jellyfin-android)
- [API Documentation](./syncplay-enhancements.md)
- [Web Client Integration](./syncplay-web-client-integration.md)
- [UI Recommendations](./syncplay-ui-recommendations.md)
