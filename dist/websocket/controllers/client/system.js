// import WebSocketServerBaseController from '../../controller/server/base.js';
import { WebSocketClientBaseController } from '../../index.js';
export default class SystemController extends WebSocketClientBaseController {
    clientList = (clientWebSocket, webSocketClientId, data) => {
        // console.log('client list receieved (client): ', data);
    };
}
//# sourceMappingURL=system.js.map