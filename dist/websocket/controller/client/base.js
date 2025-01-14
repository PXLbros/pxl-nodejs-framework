export default class WebSocketServerBaseController {
    sendMessage;
    redisInstance;
    queueManager;
    databaseInstance;
    constructor({ sendMessage, redisInstance, queueManager, databaseInstance }) {
        this.sendMessage = sendMessage;
        this.redisInstance = redisInstance;
        this.queueManager = queueManager;
        this.databaseInstance = databaseInstance;
    }
}
//# sourceMappingURL=base.js.map