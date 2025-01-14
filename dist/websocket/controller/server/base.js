export default class WebSocketServerBaseController {
    webSocketServer;
    redisInstance;
    queueManager;
    databaseInstance;
    constructor({ webSocketServer, redisInstance, queueManager, databaseInstance }) {
        this.webSocketServer = webSocketServer;
        this.redisInstance = redisInstance;
        this.queueManager = queueManager;
        this.databaseInstance = databaseInstance;
    }
}
//# sourceMappingURL=base.js.map