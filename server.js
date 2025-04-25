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
    
    socket.on("createRoom", function(data) {
        console.log("createRoom event received");
        const roomId = uuidv4(); // 서버가 생성
        const roomName = data.roomName;
        const maxPlayers = data.maxPlayers;
        socket.join(roomId);
        socket.emit("createdRoom", { roomId });
        socketRooms.set(socket.id, roomId);
        players[socket.id] = { x: 0, y: 0, dirX: 0, dirY: 0, speed: 2, isAlive: true };
        roomList.push({
            roomName: roomName,
            roomId: roomId,
            current: 1,
            max: maxPlayers
        }); // 방 리스트에 추가
        activeRooms.add(roomId);
    });

    socket.on("joinRoom", function({ roomId }) {
        const roomObj = roomList.find(r => r.roomId === roomId);

        if (!roomObj) {
            socket.emit("errorJoin", { message: "존재하지 않는 방입니다." });
            return;
        }

        if (roomObj.current >= roomObj.max) {
            socket.emit("errorJoin", { message: "방이 가득 찼습니다." });
            return;
        }

        socket.join(roomId);
        roomObj.current++;

        socket.emit("joinedRoom", { roomId });
        console.log("joinedRoom event emitted: ", roomId);
        socketRooms.set(socket.id, roomId);
        players[socket.id] = { x: 0, y: 0, dirX: 0, dirY: 0, speed: 2, isAlive: true };
    });

    socket.on("getRoomList", () => {
        console.log("getRoomList 요청됨");
        console.log("보내는 JSON:", JSON.stringify(roomList, null, 2));
        // 방 목록을 클라이언트로 전송
        socket.emit("roomList", roomList);
        console.log("방 목록 전송됨: ", roomList);
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

    socket.on("startGame", () => {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return;
    
        io.to(roomId).emit("gameStarted");
        console.log(`게임 시작: 방 ${roomId}`);
    });
    
    // 현재 방 인원 요청 처리
    socket.on("getRoomPlayerCount", () => {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return;
    
        const roomObj = roomList.find(r => r.roomId === roomId);
        if (roomObj) {
            socket.emit("roomPlayerCount", {
                current: roomObj.current,
                max: roomObj.max
            });
        }
    });
    
    socket.on("getPlayers", () => {
        const roomId = socketRooms.get(socket.id);
        if (!roomId) return;
    
        const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        console.log("현재 방에 있는 소켓 ID들: ", socketsInRoom);
        socket.emit("playersInRoom", socketsInRoom); // [ 'abc123', 'def456' ... ]
    });

    socket.on("move", (dir) => {
        if (!players[socket.id]) {
            console.log("⚠️ move 요청, but 플레이어 없음:", socket.id);
            return;
        }
        
        if (players[socket.id]) {  // players 객체가 존재하는 경우에만 처리
            players[socket.id].x = dir.x;
            players[socket.id].y = dir.y;
        }
        const roomId = socketRooms.get(socket.id);
        io.to(roomId).emit("move", {
            id: socket.id,
            x: players[socket.id].x,
            y: players[socket.id].y
        });
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
            const roomObj = roomList.find(r => r.roomId === roomId);
            roomObj.current--; // 방의 현재 인원 수 감소
            console.log(`방 ${roomId}의 현재 인원 수: ${roomObj.current}`);
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
    
        console.log(`kill 요청: ${socket.id} → ${targetId}, 방: ${roomId}`);
        if (!roomId || !players[targetId] || !players[socket.id]) return;
    
        // 같은 방에 있어야 함
        if (socketRooms.get(targetId) !== roomId) return;
    
        if (!players[socket.id].isAlive) {
            console.log("🟥 킬 실패: 공격자", socket.id, "는 이미 죽어있음");
            return;
        }
        
        if (!players[targetId].isAlive) {
            console.log("🟥 킬 실패: 대상", targetId, "는 이미 죽어있음");
            return;
        }
        // 둘 다 살아 있어야 함
        if (!players[socket.id].isAlive || !players[targetId].isAlive) return;
    
        players[targetId].isAlive = false;
        io.to(roomId).emit("killed", { victimId: targetId, killerId: socket.id });
        console.log("🟩 킬 성공:", socket.id, "→", targetId);
        console.log(` ${socket.id} → ${targetId}`);
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
        // p.x += p.dirX * p.speed;
        // p.y += p.dirY * p.speed;
    }

    // 각 방에만 해당 상태 전송
    for (const roomId in roomPlayerMap) {
        io.to(roomId).emit("updatePlayers", roomPlayerMap[roomId]);
    }
}, TICK_INTERVAL);

console.log("Server Start");