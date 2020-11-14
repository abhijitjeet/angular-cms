import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Content } from './models/content.model';
import { FolderService } from './folder.service';
import { convertObjectToUrlQueryString } from '../../helpers/common';

export abstract class ContentService<T extends Content> extends FolderService<T> {

    constructor(httpClient: HttpClient) {
        super(httpClient);
    }

    createContent(content: Partial<T>): Observable<T> {
        return this.httpClient.post<T>(this.apiUrl, content);
    }

    editContent(content: Partial<T>): Observable<T> {
        return this.httpClient.put<T>(`${this.apiUrl}/${content._id}?versionId=${content.versionId}`, content);
    }

    publishContent(contentId: string, versionId: string): Observable<T> {
        return this.httpClient.put<T>(`${this.apiUrl}/publish/${contentId}?versionId=${versionId}`, {});
    }

    getContentChildren(parentId: string): Observable<T[]> {
        return this.httpClient.get<T[]>(`${this.apiUrl}/children/${parentId}`);
    }

    getContent(contentId: string, versionId: string, language?: string, host?: string): Observable<T> {
        const query = convertObjectToUrlQueryString({ versionId, language });
        return this.httpClient.get<T>(`${this.apiUrl}/${contentId}?${query}`);
    }

    getContentVersions(contentId: string): Observable<T[]> {
        return this.httpClient.get<T[]>(`${this.apiUrl}/version/${contentId}`);
    }

    setPrimaryVersion(versionId: string): Observable<T> {
        return this.httpClient.put<T>(`${this.apiUrl}/version/${versionId}`, {});
    }

    softDeleteContent(contentId: string): Observable<[T, any]> {
        return this.httpClient.delete<[T, any]>(`${this.apiUrl}/${contentId}`);
    }

    cutContent(actionParams: { sourceContentId: string, targetParentId: string }): Observable<T> {
        return this.httpClient.post<T>(`${this.apiUrl}/cut`, actionParams);
    }

    copyContent(actionParams: { sourceContentId: string, targetParentId: string }): Observable<T> {
        return this.httpClient.post<T>(`${this.apiUrl}/cut`, actionParams);
    }
}
