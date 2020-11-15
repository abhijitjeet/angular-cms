/**
 * Function.prototype
 */
export type ClassOf<T> = new (...args: any[]) => T;
/**
 * Object.prototype
 */
export type CmsObject = { [key: string]: any };

export type CmsTab = {
    /**
     * The tab name
     */
    name: string,
    /**
     * The title of each tab
     */
    title: string,
    /**
     * The number of area in each tab
     */
    areas: number
};

export type CmsImage = {
    src: string,
    alt: string,
    thumbnail: string
};

export type CmsUrl = {
    url: string,
    text: string
    target: '_blank ' | '_self' | '_parent' | '_top'
};

export type ContentReference = {
    id: string
    type: 'page' | 'block' | 'media' | 'folder_block' | 'folder_media'
    contentType: string
    [propName: string]: any
};
