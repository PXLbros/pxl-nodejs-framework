export var WebSocketRedisSubscriberEvent;
(function (WebSocketRedisSubscriberEvent) {
    WebSocketRedisSubscriberEvent["ClientConnected"] = "clientConnected";
    WebSocketRedisSubscriberEvent["ClientDisconnected"] = "clientDisconnected";
    WebSocketRedisSubscriberEvent["DisconnectClient"] = "disconnectClient";
    WebSocketRedisSubscriberEvent["ClientJoinedRoom"] = "clientJoinedRoom";
    WebSocketRedisSubscriberEvent["ClientLeftRoom"] = "clientLeftRoom";
    WebSocketRedisSubscriberEvent["SendMessage"] = "sendMessage";
    WebSocketRedisSubscriberEvent["SendMessageToAll"] = "sendMessageToAll";
    WebSocketRedisSubscriberEvent["MessageError"] = "messageError";
    WebSocketRedisSubscriberEvent["QueueJobCompleted"] = "queueJobCompleted";
    WebSocketRedisSubscriberEvent["QueueJobError"] = "queueJobError";
    WebSocketRedisSubscriberEvent["Custom"] = "custom";
})(WebSocketRedisSubscriberEvent || (WebSocketRedisSubscriberEvent = {}));
//# sourceMappingURL=websocket.interface.js.map