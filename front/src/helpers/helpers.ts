import {api} from "../api/api";
import {RefreshResponse} from "../types/responses";

function addLeadingZero(value: number): string {
    return value.toString().padStart(2, "0");
}

export function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const formattedHours = addLeadingZero(hours);
    const formattedMinutes = addLeadingZero(minutes);
    const formattedSeconds = addLeadingZero(remainingSeconds);

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

export async function checkRefreshToken():Promise<RefreshResponse> {
    const uuid = window.localStorage.getItem("uuid");
    const response = await api.post<{uuid: string}, RefreshResponse>("auth/refresh", {uuid:uuid || ""});
    return response;
}