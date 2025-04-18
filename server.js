import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const players = {};
const socketRooms = new Map();
const roomList = [];
const TICK_RATE = 20; // 초당 20번
const TICK_INTERVAL = 1000 / TICK_RATE;
const io = new Server(3000);
const activeRooms = new Set();
var Rooms = [];
var Users = [];

io.on("connection", (socket) => {
    // Users[socket.id] = {
    //     id: socket.id,
    //     nickname: "",
    //     Room: "",
    //   }

    //   socket.on('LoginCheck', name => {
    //     //접속하기 버튼을 누르면 입장합니다.
    
    //     var check = true;
    //     //변수 하나를 생성
    
    //     for (var k in Users) {
    //       if (Users[k].nickname == name) {
    //         check = false;
    //         break;
    //       }
    //     }
    //     //닉네임이 있는지 없는지 파악합니다.
    
    //     if (check) {
    //       //닉네임이 없다면 생성
    //       Users[socket.id].nickname = name
    //       //nickname 설정
    //       console.log(name + ": 로비진입 성공!")
    //       socket.emit('Login')
    //     }
    // });

    // function RoomResetGo() {
    //     //모든 방을 보내는 함수입니다.
    //     var roomcheck = [];
    
    //     for (room in Rooms) {
        
    //       roomcheck.push({
    //         currentCnt: Rooms[room].currentCnt,
    //         RoomMaxCnt: Rooms[room].maxCnt,
    //         name: room
    //       })
    //       //currentCnt , RoomMaxCnt,name 이라는 데이터를 보냅니다.
    
    //     }
        
    //     io.emit('RoomReset', roomcheck)
    //   }
    

    // console.log("a user connected");

    // socket.on("getRoomList", () => {
    //     console.log("getRoomList event received");
    //     socket.emit("roomList", {rooms : roomList});
    // });
    
    // socket.on('CreateCheck', (data, data2) => {

    //       //방생성 성공
    //       socket.join(data);
    //       //들어갑니다.
    
    //       Users[socket.id].Room = data
    
    
    //       Rooms[data] = {
    //         currentCnt: 1,
    //         maxCnt: Number(data2)
    //       }
    
    //       console.log(data + ": 방진입 성공!")
    
    //       socket.emit('Create')
    //       //성공했다고 이벤트를 보냅니다.
    
    
    //       RoomResetGo()
    //       //방 목록을 전부 보내는 이벤트를 실행합니다.
        
    //  });

    //  socket.on('JoinRoomCheck', (roomname) => {

    //     if (roomname in Rooms && Rooms[roomname].currentCnt < Rooms[roomname].maxCnt) {
    
    //       socket.join(roomname)
    //       socket.emit('Join', roomname)
    //       Users[socket.id].Room = roomname
    //       Rooms[roomname].currentCnt++
    
    //       var check = []
    //       socket.adapter.rooms.get(roomname).forEach((a) => {
    //         check.push(Users[a].nickname)
    //       })
    
    //       socket.to(roomname).emit('PlayerReset', check)
    //       RoomResetGo()
    //     }
    //     else {
    //       socket.emit('JoinFailed')
    //     }
    //   });

    socket.on("createRoom", function() {
        console.log("createRoom event received");
        const roomId = uuidv4(); // 서버가 생성
        socket.join(roomId);
        socket.emit("createdRoom", { roomId });
        socketRooms.set(socket.id, roomId);
        players[socket.id] = { x: 0, y: 0, dirX: 0, dirY: 0, speed: 2, isAlive: true };
        roomList.push(roomId); // 방 리스트에 추가
        activeRooms.add(roomId);
        // console.log('방 생성됨: ' + roomId);
        // console.log('현재 방 리스트: ', roomList);
        // console.log('socket id : ' + socket.id);
        // console.log(io.sockets.adapter.rooms.get(roomId));
    });

    socket.on("joinRoom", function({ roomId }) {
        if (!roomId) {
            socket.emit("errorJoin", { message: "잘못된 방 ID입니다." });
            return;
        }
        console.log("adapter room id : ", io.sockets.adapter.rooms.get(roomId));
        const room = io.sockets.adapter.rooms.get(roomId);
        console.log("joinRoom event received", roomId, room);
        console.log('socket id : ' + socket.id);
        console.log('room id : ' + roomId);
        console.log('room : ' + room);

        if (room) {
            socket.join(roomId);
            socket.emit("joinedRoom", { roomId });
            socketRooms.set(socket.id, roomId);
            players[socket.id] = { x: 0, y: 0, dirX: 0, dirY: 0, speed: 2 };
        } else {
            socket.emit("errorJoin", { message: "존재하지 않는 방입니다." });
        }
    });

    socket.on("leaveRoom", function(roomData) {
        socket.leave(roomData.roomId);
        socket.emit("exitRoom");
        socket.to(roomData.roomId).emit("endGame");

        var roomId = socketRooms.get(socket.id);
        const roomIdx = rooms.indexOf(roomId);
        if (roomIdx !== -1) {
            rooms.splice(roomIdx, 1);
            console.log('방 삭제됨: ' + roomId);
        }
        socketRooms.delete(socket.id);
    });

    socket.on("move", (dir) => {
        // 방향 정보만 저장 (dir = { x: -1, y: 0 } 등)
        if (players[socket.id]) {  // players 객체가 존재하는 경우에만 처리
            players[socket.id].dirX = dir.x;
            players[socket.id].dirY = dir.y;
        }
    });

    socket.on("gameOver", async function(data) {
        const { roomId, winner, myPlayerType } = data;
        console.log(`게임 종료: Room(${roomId}), 승자: ${winner}, 내 플레이어 타입: ${myPlayerType}`);

        socket.to(roomId).emit("gameEnded", { winner: winner });
    });

    socket.on("sendMessage", function(message) {
        console.log('메시지를 받았습니다: ' + message.roomId + ' ' + message.nickName + ' : ' + message.message);
        socket.to(message.roomId).emit('receiveMessage', { nickName: message.nickName, message: message.message });
    });

    socket.on("disconnect", () => {
        const roomId = socketRooms.get(socket.id);
        if (roomId) {
            socketRooms.delete(socket.id);  // socketRooms에서 해당 소켓 제거
        }
        delete players[socket.id]; // 플레이어 데이터 삭제
        delete Users[socket.id]; // 사용자 데이터 삭제
    });

    socket.on("reconnectToRoom", (data) => {
        const { roomId } = data;
        socket.join(roomId);
        socket.emit("reconnected", { roomId });
    });

    socket.on("kill", (data) => {
        const { targetId } = data;
        const roomId = socketRooms.get(socket.id);
    
        if (!roomId || !players[targetId] || !players[socket.id]) return;
    
        // 같은 방에 있어야 함
        if (socketRooms.get(targetId) !== roomId) return;
    
        // 둘 다 살아 있어야 함
        if (!players[socket.id].isAlive || !players[targetId].isAlive) return;
    
        players[targetId].isAlive = false;
    
        io.to(roomId).emit("killed", { victimId: targetId, killerId: socket.id });
    });

    socket.on("fishing", (data) => {
        // TODO: fishing 이벤트 처리 로직 구현
    });
});

setInterval(() => {
    // 방 별로 묶기
    const roomPlayerMap = {};

    for (const id in players) {
        const roomId = socketRooms.get(id);
        if (!roomId) continue;

        if (!roomPlayerMap[roomId]) {
            roomPlayerMap[roomId] = {};
        }

        roomPlayerMap[roomId][id] = players[id];

        // 이동 처리
        const p = players[id];
        p.x += p.dirX * p.speed;
        p.y += p.dirY * p.speed;
    }

    // 각 방에만 해당 상태 전송
    for (const roomId in roomPlayerMap) {
        io.to(roomId).emit("updatePlayers", roomPlayerMap[roomId]);
    }
}, TICK_INTERVAL);

console.log("Server Start");