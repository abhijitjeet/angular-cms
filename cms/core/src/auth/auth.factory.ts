import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';

export function authCheckFactory(authService: AuthService, configService: ConfigService): () => Promise<void> {
    return () => new Promise((resolve, reject) => {
        // attempt to refresh token on app start up to auto authenticate
        authService.setBaseApiUrl(configService.baseApiUrl).refreshToken()
            .subscribe()
            .add(resolve);
    });
}
