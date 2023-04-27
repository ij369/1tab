const indicator = document.querySelector('#indicator');
const item = document.querySelectorAll('a');
const content = document.querySelector('.content');
const nav = document.querySelector('nav');
let isResizing = false; // 用于判断是否在改大小

function setIndicator(e) {
    // console.log(e.offsetTop)
    indicator.style.top = e.offsetTop + e.offsetHeight + "px";

    indicator.style.left = e.offsetLeft + "px";
    indicator.style.width = e.offsetWidth + "px";
}
setIndicator(item[0]);
item.forEach(i => {
    i.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = i.getAttribute('href');
        const targetContent = document.querySelector(targetId);

        targetContent.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });

        setIndicator(e.target);
    })
});


if ('ResizeObserver' in window) { // 现判读是否支持 ResizeObserver
    const observer = new ResizeObserver(entries => {
        if (!isResizing) {
            isResizing = true;
            setTimeout(() => {
                const {
                    scrollHeight,
                    offsetHeight
                } = content;
                if (scrollHeight > offsetHeight) {
                    nav.classList.add('show');
                } else {
                    nav.classList.remove('show');
                }
                isResizing = false;
            }, 600); // 防抖
        }
    });
    observer.observe(content);
} else {
    document.querySelector('nav').style.display = 'none'; // 不支持ResizeObserver直接隐藏掉
}

window.scrollTo(0, 0);

const savedLanguage = localStorage.getItem('language');
const savedValues = JSON.parse(localStorage.getItem("setting")) || {}; // 读取设置

if (savedValues['search_engine'] === undefined) {
    switch (navigator.language) {
        case 'zh-CN':
        case 'zh-cn': // 语言环境为简中
            search_engine.value = 'baidu';
            break;

        default: // 语言环境不是简中
            search_engine.value = 'google';
            break;
    }
} else {
    search_engine.value = savedValues['search_engine'];
}

if (savedValues['sug_select'] === undefined) {
    switch (navigator.language) {
        case 'zh-CN':
        case 'zh-cn': // 语言环境为简中
            sug_select.value = 'baidu';
            search_engine.value = 'baidu';
            break;

        default: // 语言环境不是简中
            sug_select.value = 'google';
            search_engine.value = 'google';
            break;
    }
} else {
    sug_select.value = savedValues['sug_select'];
}

const languages = {
    'en-US': 'en',
    'zh-CN': 'zh-CN',
    'zh-HK': 'zh-HK'
}; // navigator.language: 文件名

const getUserLanguage = () => {
    return savedLanguage || languages[navigator.language] || 'en';
    // 存储语言 || 浏览器语言 || 默认
};

i18next.use(i18nextXHRBackend).init({
    debug: false,
    lng: getUserLanguage(),
    fallbackLng: 'en', // 回滚语言
    backend: {
        loadPath: '../i18n/locales/{{lng}}.json',
        cache: false // 禁用缓存
    }
}, (err, t) => {
    updateContent();
});

const updateContent = () => {
    const elements = document.querySelectorAll('[i18n]');
    elements.forEach(el => {
        const content = el.getAttribute('i18n');
        el.innerHTML = i18next.t(content);
    });
    const elements2 = document.querySelectorAll('[i18n-type]');
    elements2.forEach(el => {
        const attr = JSON.parse(el.getAttribute('i18n-type'));

        Object.keys(attr).forEach(t => {
            // console.log(t, attr[t]);
            switch (t) {
                case 'input':
                    el.value = i18next.t(attr[t]);
                    break;
                case 'html':
                    el.innerHTML = i18next.t(attr[t]);
                    break;
                case 'title':
                    el.title = i18next.t(attr[t]);
                    break;
                case 'attr':
                    const [key, attribute] = attr[t].split(':');
                    console.log(key, attribute);
                    el.setAttribute(key, i18next.t(attribute));
                    break;

                default:
                    el.innerText = attr[t];
                    break;
            }
        });

    });
};

const changeLanguage = lang => {
    i18next.changeLanguage(lang, (err, t) => {
        localStorage.setItem('language', lang);
        updateContent();
        if (err) {
            console.log('语言配置出错', err);
            return;
        }
        updateContent();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const langSelect = document.getElementById('language');
    langSelect.value = getUserLanguage(); // 加载完毕后赋值下拉框语言
    langSelect.addEventListener('change', e => {
        changeLanguage(e.target.value);
    });

    if (savedValues.bgMode) {
        document.querySelector(`input[type="radio"][name="mod"][value="${savedValues.bgMode}"]`).checked = true;
    } else {
        document.querySelector(`input[type="radio"][name="mod"][value="pic"]`).checked = true;
    }
    // 如果存在则选中设置存储的值, 否则默选图片模式


    const bgModeRadios = document.querySelectorAll('input[name="mod"]');

    bgModeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            // console.log(event.target.value); // 模式
            savedValues.bgMode = event.target.value;
            localStorage.setItem("setting", JSON.stringify(savedValues));
        });
    });

    // 天气来源 //
    switch (savedValues.weatherAPI) {
        case 'https://wttr.in/?format=3':
            document.querySelector(`input[type="radio"][name="weather"][value="wttr.in"]`).checked = true;
            break;
        case '':
        case undefined: // 没有设置天气时
            document.querySelector(`input[type="radio"][name="weather"][value="close"]`).checked = true;
            break;
        default:
            document.querySelector(`input[type="radio"][name="weather"][value="personalAPI"]`).checked = true;
            break;
    }
    weather.value = savedValues.weatherAPI || ''; // 没有设置天气时赋值''
    // 天气来源 //

    if (savedValues.sug_quick) {
        preset('', savedValues.sug_quick)
    }

    // 图标获取方式 //
    if (savedValues.iconSrc) {
        document.querySelector(`input[type="radio"][name="icon"][value="${savedValues.iconSrc}"]`).checked = true;
    } else {
        document.querySelector(`input[type="radio"][name="icon"][value="close"]`).checked = true;
    }
    // 如果存在则选中设置存储的图标获取方式, 否则默选关闭

    const iconRadios = document.querySelectorAll('input[name="icon"]'); // 监听图标设置
    iconRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            // console.log(event.target.value);
            savedValues.iconSrc = event.target.value;
            localStorage.setItem("setting", JSON.stringify(savedValues));
        });
    });
    // 图标获取方式 //
});

const preset = (p, q) => {
    let preSet = q;
    switch (p) {
        case 'CN':
            preSet = [{
                "ti": "微博",
                "desc": "随时随地发现新鲜事",
                "url": "https://weibo.com/"
            }, {
                "ti": "哔哩哔哩",
                "desc": "(゜-゜)つロ 干杯~",
                "url": "https://www.bilibili.com/"
            }, {
                "ti": "QQ邮箱",
                "desc": "QQ邮箱，常联系！",
                "url": "https://mail.qq.com/"
            }, {
                "ti": "淘宝",
                "desc": "淘！我喜欢",
                "url": "https://www.taobao.com/"
            }, {
                "ti": "12306",
                "desc": "中国铁路12306",
                "url": "https://www.12306.cn/index/"
            }, {
                "ti": "豆瓣",
                "desc": "豆瓣电影",
                "url": "https://movie.douban.com/"
            }];
            break;
        case 'universal':
            preSet = [{
                "ti": "Amazon",
                "desc": "Online shopping website.",
                "url": "https://www.amazon.com/"
            }, {
                "ti": "Reddit",
                "desc": "Reddit is a network of communities.",
                "url": "https://www.reddit.com/"
            }, {
                "ti": "YouTube",
                "desc": "Enjoy the videos and music you love",
                "url": "https://www.youtube.com/",
                "ico": "https://www.gstatic.com/youtube/img/branding/favicon/favicon_144x144.png"
            }, {
                "ti": "Gmail",
                "desc": "Email service by Google.",
                "url": "https://mail.google.com/mail/?tab=rm&authuser=0&ogbl"
            }, {
                "ti": "Facebook",
                "desc": "Connect with friends, family and other people you know.",
                "url": "https://www.facebook.com/"
            }, {
                "ti": "Wikipedia",
                "desc": "Wikipedia is a free online encyclopedia",
                "url": "https://www.wikipedia.org/"
            }]
            break;
        default:
            break;
    }
    saveQuick(preSet);
    quick.value = JSON.stringify(preSet, null, 2);
    quick.style.height = `calc(${quick.scrollHeight}px + 1em)`;
    // savedValues.sug_quick = preSet;
    // localStorage.setItem("setting", JSON.stringify(savedValues));
}

const saveQuick = (quick) => {
    savedValues.sug_quick = quick;
    console.log(savedValues);
    localStorage.setItem("setting", JSON.stringify(savedValues));
}
const changePreferences = (id, value) => {
    switch (id) {
        case 'sug_select':
        case 'search_engine':
            savedValues[id] = value;
            localStorage.setItem("setting", JSON.stringify(savedValues));
            parent.document.getElementById(id).value = value;
            parent.document.getElementById(id).dispatchEvent(new Event('change'));
            break;


        default:
            break;
    }
}


// 加载图像
const indexedDB = window.indexedDB;
// 打开或创建IndexedDB数据库
const imgsRequest = indexedDB.open('images-db', 1);
const vidsrequest = indexedDB.open('videos-db', 1);
let imgsDb;
let vidsDb;

imgsRequest.onupgradeneeded = event => {
    imgsDb = event.target.result;
    imgsDb.createObjectStore('images');
    imgsDb.createObjectStore('preview');

};

vidsrequest.onupgradeneeded = event => {
    vidsDb = event.target.result;
    vidsDb.createObjectStore('videos');
};


imgsRequest.onerror = event => {
    console.error('图片数据库错误:', event.target.error);
};

vidsrequest.onerror = event => {
    console.error('影片数据库错误:', event.target.error);
};


imgsRequest.onsuccess = event => {
    imgsDb = event.target.result;
    updatePicsList();
};

function updatePicsList() {
    const fileList = document.getElementById('file-list');
    const transaction = imgsDb.transaction(['images'], 'readonly');
    const objectStore = transaction.objectStore('images');
    const request = objectStore.getAllKeys();
    request.onsuccess = event => {
        // 检查preview数据库是否存在，如果不存在则创建该数据库
        const fileNames = event.target.result;
        fileList.innerHTML = '';

        const promises = [];

        fileNames.forEach(file => {
            const li = document.createElement('li');

            // 创建 canvas 元素
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = 100 * dpr;
            canvas.height = 100 * dpr;
            canvas.style.width = '100px';
            canvas.style.height = '100px';
            canvas.style.borderRadius = '5px';
            canvas.title = file; // 提示词为文件名, 不一定会立即加载

            const fileName = document.createElement('section');
            fileName.title = file;
            fileName.innerHTML = filename(file); // 拆分文件名

            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Delete';
            deleteButton.addEventListener('click', () => {
                const deleteTransaction = imgsDb.transaction(['images'], 'readwrite');
                const deleteObjectStore = deleteTransaction.objectStore('images');
                const deleteRequest = deleteObjectStore.delete(file);
                deleteRequest.onsuccess = () => {

                    let li = deleteButton.parentNode;
                    li.parentNode.removeChild(li); // 删除
                    updatePicsList();
                };
                deleteRequest.onerror = event => {
                    console.error('IndexedDB error:', event.target.error);
                };
            });
            li.appendChild(canvas);

            // li.appendChild(fileName);
            li.appendChild(deleteButton);
            fileList.appendChild(li);

            // 创建缩略图

            const pretransaction = imgsDb.transaction(['preview'], 'readwrite');
            const preobjectStore = pretransaction.objectStore('preview');
            const previewRequest = preobjectStore.get(file); // 获取对应文件的预览图

            const previewMap = {}; // 存储预览图 Blob 和对应的 key 名称


            previewRequest.onsuccess = event => {
                const previewBlob = event.target.result;
                if (previewBlob) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = canvas.getContext('2d');
                        ctx.scale(dpr, dpr);
                        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
                    };
                    img.src = URL.createObjectURL(previewBlob);
                } else {
                    // console.log(file + ' 未创建预览图')
                    const transaction = imgsDb.transaction(['images'], 'readonly');
                    const objectStore = transaction.objectStore('images');
                    const getRequest = objectStore.get(file);
                    getRequest.onsuccess = event => {
                        const blob = event.target.result;
                        const img = new Image();
                        img.onload = () => {
                            // 计算正方形边长和截取位置
                            const size = Math.min(img.width, img.height);
                            const x = (img.width - size) / 2;
                            const y = (img.height - size) / 2;
                            // 绘制缩略图
                            const ctx = canvas.getContext('2d');
                            ctx.scale(dpr, dpr);
                            ctx.drawImage(img, x, y, size, size, 0, 0, canvas.width / 2, canvas.height / 2);
                            canvas.toBlob(blob => {
                                const pretransaction = imgsDb.transaction(['preview'], 'readwrite');
                                const preobjectStore = pretransaction.objectStore('preview');
                                preobjectStore.put(blob, file);
                                console.log(`${file} 缩略图占地 ${blob.size / 1024 } KB`)
                            });
                        };
                        img.src = URL.createObjectURL(blob);

                    };
                    // console.log(file + ' 创建预览图完毕')
                }
            }
        });
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.error);
    };
}

function clearPreviewDb() {
    if (confirm('您确定要清空图片预览吗？')) {
        const transaction = imgsDb.transaction(['preview'], 'readwrite');
        const objectStore = transaction.objectStore('preview');

        objectStore.clear();

        transaction.onsuccess = event => {
            console.log('Database cleared.');
        };
    }
}

vidsrequest.onsuccess = event => {
    vidsDb = event.target.result;
    updateVidsList();
};

const filename = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.'); // 最后一个句点
    let name = fileName.slice(0, lastDotIndex);
    if (name.length >= 27) {
        name = fileName.slice(0, lastDotIndex).slice(0, 24) + '... '
    } else {
        name = fileName.slice(0, lastDotIndex)

    }
    const ext = '.' + fileName.slice(lastDotIndex + 1);
    // return {
    //     name, // 文件名
    //     ext // 后缀名
    // };
    return `<span>${name}</span><span>${ext}</span>`

};

function updateVidsList(blobUrls = []) {
    const videoList = document.getElementById('video-list');
    const transaction = vidsDb.transaction('videos', 'readonly');
    const objectStore = transaction.objectStore('videos');
    const request = objectStore.getAll();

    request.onsuccess = event => {
        const blobs = event.target.result;
        videoList.innerHTML = '';

        if (blobs.length > 0) {
            blobs.forEach(blob => {
                const url = URL.createObjectURL(blob);
                blobUrls.push(url);

                const li = document.createElement('li');
                const a = document.createElement('video');
                const fileName = document.createElement('section');
                fileName.title = blob.name;
                fileName.innerHTML = filename(blob.name);
                const deleteButton = document.createElement('button');
                a.textContent = blob.name;
                a.src = url;
                a.height = 100;
                a.width = 100;
                a.target = '_blank';
                a.title = blob.name; // 提示词为文件名, 不一定会立即加载
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', () => {
                    const deleteTransaction = vidsDb.transaction('videos', 'readwrite');
                    const deleteObjectStore = deleteTransaction.objectStore('videos');
                    const deleteRequest = deleteObjectStore.delete(blob.name);

                    deleteRequest.onsuccess = () => {
                        updateVidsList(blobUrls);
                    };

                    deleteRequest.onerror = event => {
                        console.error('IndexedDB error:', event.target.error);
                    };
                });

                li.appendChild(a);
                // li.appendChild(fileName);
                li.appendChild(deleteButton);
                videoList.appendChild(li);
            });
            addVideoPreview(); // 添加预览
        } else {
            savedValues.bgMode = 'pic';
            localStorage.setItem("setting", JSON.stringify(savedValues)); // 没有影片改为图片模式
        }
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.error);
    };
}


document.body.addEventListener('dragover', event => {
    event.preventDefault(); // 阻止默认世界
});

document.body.addEventListener('drop', event => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    file(files);
});

input.addEventListener('change', event => {
    const files = event.target.files;
    file(files);
})

function file(files) { // 处理多个文件
    const processFile = file => {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            console.log(`${file.name} 不是图像或视频类型`);
            return Promise.resolve();
        }

        return new Promise(resolve => {
            const dbName = file.type.startsWith('image/') ? 'images' : 'videos';
            const storeName = file.type.startsWith('image/') ? 'images' : 'videos';
            const db = dbName === 'images' ? imgsDb : vidsDb;
            const transaction = db.transaction([storeName], 'readwrite');
            const objectStore = transaction.objectStore(storeName);
            const request = objectStore.put(file, file.name);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = event => {
                console.error('IndexedDB error:', event.target.error);
                resolve();
            };
        });
    };

    const promises = [];

    for (let i = 0; i < files.length; i++) {
        promises.push(processFile(files[i]));
    }

    Promise.all(promises).then(() => {
        updatePicsList();
        updateVidsList();
    });
}

function addVideoPreview() { // 预览播放
    const videos = document.querySelectorAll('video');

    const handleMouseover = (event) => { // 静音并播放视频
        const video = event.target;
        video.muted = true;
        video.play();
    };

    const handleMouseout = (event) => { // 移开暂停视频
        const video = event.target;
        video.pause();
    };

    const handleContextMenu = (event) => {
        event.preventDefault();
    };

    videos.forEach(video => {
        video.removeEventListener('mouseover', handleMouseover);
        video.removeEventListener('mouseout', handleMouseout);
        video.removeEventListener('contextmenu', handleContextMenu);
    });

    videos.forEach(video => {
        video.addEventListener('mouseover', handleMouseover);
        video.addEventListener('mouseout', handleMouseout);
        video.addEventListener('contextmenu', handleContextMenu);
    });
}


const setWeather = () => {
    savedValues['weatherAPI'] = weather.value;
    localStorage.setItem("setting", JSON.stringify(savedValues)); // 保存
}