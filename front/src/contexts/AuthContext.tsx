import React, {createContext, useContext, useEffect, useState} from "react";
import {LoggedUser, LoginUser, RegisterUser} from "./../types/user";
import {api} from "../api/api";
import {AuthResponse, RefreshResponse} from "../types/responses";
import {HttpError} from "../types/error";

interface AuthContextProps {
    children:React.ReactNode
}

type AuthContextType = {
    userData:LoggedUser | undefined;
    loggedIn:boolean;
    loading:boolean;
    registerUser:(username:string, email:string, password:string)=>Promise<void>;
    loginUser:(password:string, usernameOrEmail:string)=>Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export function useAuth():AuthContextType {
    return useContext(AuthContext);
}

export function AuthProvider(props:AuthContextProps):React.ReactElement {
    const {children} = props;
    const [userData, setUserData] = useState<LoggedUser | undefined>();
    const [loggedIn, setLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    async function registerUser(username:string, email:string, password:string):Promise<void> {
        const body = {username, email, password};
        const response = await api.post<RegisterUser, AuthResponse>("auth/signup", body);
        setUserData(response.user);

        // El backend ha generado un uuid para este dispositivo, guardarlo en el localstorage para refrescar el token
        window.localStorage.setItem("uuid", response.uuid);
    }

    async function loginUser(usernameOrEmail:string, password:string):Promise<void> {
        const body = {usernameOrEmail, password};
        const response = await api.post<LoginUser, AuthResponse>("auth/login", body);
        setUserData(response.user);

        // El backend ha generado un uuid para este dispositivo, guardarlo en el localstorage para refrescar el token
        window.localStorage.setItem("uuid", response.uuid);
    }

    useEffect(()=>{
        /**
         * Este useEffect se encarga de validar el estado de autenticación del usuario cada vez que
         * abra/recargue la página
         */
        async function checkAccessToken():Promise<LoggedUser> {
            const response = await api.get<LoggedUser>("auth/me");
            return response;
        }

        async function checkRefreshToken():Promise<RefreshResponse> {
            const uuid = window.localStorage.getItem("uuid");
            const response = await api.post<{uuid: string}, RefreshResponse>("auth/refresh", {uuid:uuid || ""});
            return response;
        }

        async function checkAuth():Promise<void> {
            try {
                const myData = await checkAccessToken();

                // No hay excepción, el usuario tenía un token de acceso
                setUserData(myData);
                setLoggedIn(true);
                setLoading(false);
            } catch (e) {
                // Excepción encontrada, se comprueba si es por 401
                const error = e as HttpError;

                if (error.status !== 401 || error.tokenStatus !== "REFRESH") {
                    // Otra cosa ha causado la excepción o no existe token de refresco, interrumpir login
                    setLoggedIn(false);
                    setLoading(false);
                    return;
                }
                // Excepción 401, se prueba a refrescar el access token con el refresh token
                try {
                    await checkRefreshToken();

                    // El resfresh token no ha causado excepción, se comprueba si el nuevo access token funciona
                    const myData = await checkAccessToken();

                    // No hay excepción, el access token es válido
                    setUserData(myData);
                    setLoggedIn(true);
                    setLoading(false);
                } catch (refreshError) {
                    // Excepción, independientemente del tipo que sea, interrumpir login
                    setLoggedIn(false);
                    setLoading(false);
                }
            }
        }
        void checkAuth();
    }, []);

    return (
        <AuthContext.Provider value={{
            userData:userData,
            registerUser:registerUser,
            loginUser:loginUser,
            loggedIn:loggedIn,
            loading:loading
        }}
        >
            {children}
        </AuthContext.Provider>
    );
}