const searchE = document.getElementById('search_engine'); // 搜索引擎 select 隐藏，改由 labelSwitcher("search_engine") 控制
const searchInput = document.getElementById('search_input');
const sugList = document.getElementById('sug_list');
const sugEngine = document.getElementById('sug_select');
const searchBtn = document.getElementById('search_btn');
let savedValues = JSON.parse(localStorage.getItem("setting")) || {}; // 读取设置
let cache = {}; // 用于记忆建议词
let sugTimer = null; // 用于延迟建议词
let selectedIndex = -1; // 选中的建议词索引
let quick = savedValues['sug_quick'] || []; // 处理 快速启动 的内容
const transparentPic = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

window.addEventListener("storage", e => {
    // console.log(e);
    if (e.key === "language") {
        i18next.changeLanguage(e.newValue, (err, t) => {
            if (err) {
                console.log('语言配置出错', err);
                return;
            }
            updateContent();
        });
    }
    if (e.key === "setting") {
        savedValues = JSON.parse(localStorage.getItem("setting")) || {}; // 读取设置
        quick = savedValues['sug_quick'] || []; // 处理 快速启动 的内容
        displayBg();
        displayQuick();
        getWeather();
        displayIcons();

    }


}); // 监听localstorage

/// i18n ///
const languages = {
    'en-US': 'en',
    'zh-CN': 'zh-CN',
    'zh-HK': 'zh-HK'
}; // navigator.language: 文件名

const getUserLanguage = () => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || languages[navigator.language] || 'en';
    // 存储语言 || 浏览器语言 || 默认
};

i18next.use(i18nextXHRBackend).init({
    debug: false,
    lng: getUserLanguage(),
    fallbackLng: 'en', // 回滚语言
    backend: {
        loadPath: '/i18n/locales/{{lng}}.json'
    }
}, (err, t) => {
    updateContent();
    menuinit();
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
/// i18n ///

const delQuick = (newTabID) => {
    const index = Number(newTabID.split('link')[1]);
    if (index > -1 && index < quick.length) {
        quick.splice(index, 1);
    }
    savedValues['sug_quick'] = quick; // 更新新设置的快速启动
    localStorage.setItem("setting", JSON.stringify(savedValues));
    displayQuick(quick)
}

const addNewQuick = (newQuick) => {
    quick.push(newQuick);
    return quick;
}
const findQuick = (url) => {
    const index = quick.findIndex(obj => obj['url'] === url);
    return quick[index];
}; // 获取网址所在的索引

const updateQuick = (newTabID, update) => {
    // const index = quick.findIndex(obj => obj['url'] === url);

    // if (index >= 0) { // 如果找到了url所在索引，则更新
    //     quick[index] = {...quick[index], ...update };
    // } else {
    //     throw new Error(`找不到`);
    // }    
    const index = Number(newTabID.split('link')[1]);
    console.log(index);
    quick[index] = {...quick[index], ...update };
    console.log(index, update, quick)

    return quick;
};
/// 快速启动 处理 ///


/// 建议词&搜索处理 ///
function showSuggestions(sugs) {
    sugList.innerHTML = ''; // 清空原有的建议词

    sugs.forEach((sug, index) => { // 添加新建议词
        const sugItem = document.createElement('li');
        sugItem.className = 'sug_item';
        // sugItem.textContent = sug;
        // sugItem.appendChild(document.createTextNode(sug)); // o2
        sugItem.innerText = sug;
        sugItem.addEventListener('click', () => {
            searchInput.value = sug; // 当点击建议词时, 将其设为输入框的值
            const key = searchInput.value.trim();
            if (key.length > 0) {
                searchKey(key); // 打开搜索
            }
        });
        sugList.appendChild(sugItem);

        // 鼠标移入移出
        sugItem.addEventListener('mouseover', () => { // 移入
            clearSelected(); // 清除所有建议词状态
            sugItem.classList.add('selected');
            selectedIndex = index;
        });
        sugItem.addEventListener('mouseout', () => { // 移出
            sugItem.classList.remove('selected');
            selectedIndex = -1;
        });

    });

    if (sugs.length > 0) { // 如果有建议词，显示建议词列表
        sugList.style.display = 'block';
    } else {
        sugList.style.display = 'none';
        document.querySelector('.link-box').classList.remove('u_hidden');
    }

    function clearSelected() { // 清除所有建议词的选中状态
        const sugItems = sugList.querySelectorAll('.sug_item');
        sugItems.forEach(item => {
            item.classList.remove('selected');
        });
    }
}

searchInput.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
            if (!sugList.classList.contains('IME')) { // 避免IME 上按键起冲突
                e.preventDefault();
                selectedIndex++;
                if (selectedIndex >= sugList.children.length) {
                    selectedIndex = 0;
                }
                updateSelected();
            }
            break;
        case 'ArrowUp':
        case 'ArrowLeft':
            if (!sugList.classList.contains('IME')) {
                e.preventDefault();
                selectedIndex--;
                if (selectedIndex < 0) {
                    selectedIndex = sugList.children.length - 1;
                }
                updateSelected();
            }
            break;

        case 'Enter':
            if (!sugList.classList.contains('IME')) {
                if (selectedIndex >= 0) {
                    const selectedSug = sugList.children[selectedIndex];
                    searchInput.value = selectedSug.textContent;
                    const query = searchInput.value.trim();
                    if (query.length > 0) {
                        searchKey(query); // 打开搜索
                    }
                } else {
                    const query = searchInput.value.trim();
                    if (query.length > 0) {
                        searchKey(query); // 打开搜索
                    }
                }
                sugList.style.display = 'none';
            }
            break;

        case 'Delete':
        case 'Backspace':
            clearTimeout(sugTimer);
            break;
        default:
            break;
    }
});

function updateSelected() { // 处理建议词索引
    for (let i = 0; i < sugList.children.length; i++) {
        const sugItem = sugList.children[i];
        if (i === selectedIndex) {
            sugItem.classList.add('selected');
            searchInput.value = sugItem.textContent;
        } else {
            sugItem.classList.remove('selected');
        }
    }
}

function search() { // 建议词
    const query = searchInput.value.trim();
    if (!query) { // 输入为空
        // sugList.innerHTML = '';
        sugList.textContent = '';
        sugList.style.display = 'none';
    } else if (cache[query] && sugEngine.value !== 'close') { // 缓存有记录用缓存
        showSuggestions(cache[query]);
    } else {
        // JSONP
        let url;
        switch (sugEngine.value) {
            case 'close':
                cache = {};
                return;

            case 'baidu':
                url = `https://www.baidu.com/su?wd=${encodeURIComponent(query)}&cb=window.baidu.sug`;
                break;

            case 'baidu_test':
                url = `https://www.baidu.com/sugrec?ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(query)}&cb=window.baidu.sug`;
                break;

            case 'taobao':
                url = `https://suggest.taobao.com/sug?code=utf-8&q=${encodeURIComponent(query)}&callback=window.taobao.sug`;
                break;

            case 'yandex':
                url = `https://suggest.yandex.ru/suggest-ya.cgi?part=${encodeURIComponent(query)}&v=4&uil=${encodeURIComponent('en')}&callback=window.yandex.sug`;
                break;

            case 'bing':
                url = `https://api.bing.com/qsonhs.aspx?type=cb&q=${encodeURIComponent(query)}&cb=window.bing.sug`;
                break;

            default:
                url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&jsonp=window.google.sug`;
                break;
        }

        const script = document.createElement('script');
        script.src = url;
        document.body.appendChild(script);
        // 将计时器设为空，表示上一次搜索已经完成

        script.onload = () => {
            document.body.removeChild(script); // 清理 script标签
        };

        script.onerror = () => {
            document.body.removeChild(script);
        };
    }
}

window.google = {
    sug: function(data) {
        const suggestions = data[1] || [];
        // showSuggestions(suggestions);
        if (!suggestions.length == 0) {
            showSuggestions(suggestions);
            // 将建议词添加到缓存中
            cache[data[0]] = data[1];
            // console.log(cache);
        } else {
            suggestions[1] = searchInput.value.trim();
            showSuggestions(suggestions); // 防止建议词为空建议词直接关闭, 例如Google: 我想
        }
    }
};
window.baidu = {
    sug: function(data) {
        console.log(data)
        const suggestions = data.s || [];

        if (!suggestions.length == 0) {
            showSuggestions(suggestions);
            // 将建议词添加到缓存中
            cache[data.q] = data.s;
            // console.log(cache);
        } else {
            suggestions[1] = searchInput.value.trim();
            showSuggestions(suggestions); // 防止建议词为空建议词直接关闭, 例如Google: 我想
        }
    }
};
window.bing = {
    sug: function(data) {
        // console.log(data);
        const suggestions = data.AS.Results.flatMap(result => result.Suggests.map(suggest => suggest.Txt)) || [];
        showSuggestions(suggestions);
    }
};
window.yandex = {
    sug: function(data) {
        const suggestions = data[1] || [];
        showSuggestions(suggestions);
    }
};
window.taobao = {
    sug: function(data) {
        const suggestions = data.result || [];
        const filteredSuggestions = suggestions.map(suggestion => suggestion[0]);
        showSuggestions(filteredSuggestions);
    }
};

// searchInput.addEventListener('input', () => {
//     search();
// }); // 绑定输入框的事件，当输入框中的内容发生变化时，执行搜索并显示建议词
searchInput.addEventListener('click', () => {
    sugList.style.display = '';
    document.querySelector('.link-box').classList.add('u_hidden');
});

searchInput.addEventListener('input', () => {
    clearTimeout(sugTimer);
    sugTimer = setTimeout(() => {
        search();
    }, 231);
});

// searchInput.addEventListener('keydown', (event) => {
//     if (event.key === 'Delete' || event.key === 'Backspace') {
//         clearTimeout(sugTimer);
//     }
// });

function searchKey(key, engine = searchE.value) {
    switch (engine) {
        case 'baidu':
            window.location.href = `https://www.baidu.com/s?word=${encodeURIComponent(key)}`;
            break;

        case 'bing':
            window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(key)}`;
            break;

        case 'google':
        default:
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(key)}`;
            break;
    }
}

// 绑定按钮的事件，当点击按钮时执行搜索
searchBtn.addEventListener('click', () => {
    search();
    const query = searchInput.value.trim();
    if (query.length > 0) {
        searchKey(query); // 打开搜索
    }
});

// 绑定建议词列表的事件，当点击列表外的区域时，隐藏建议词列表
document.addEventListener('click', (event) => {
    const isClickInside = sugList.contains(event.target) || event.target === searchInput;
    if (!isClickInside) {
        sugList.style.display = 'none';
        document.querySelector('.link-box').classList.remove('u_hidden');
    }
});


const userAgent = window.navigator.userAgent;
const platform = navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || ''; // 判断平台 platform将会弃用

const IMEHeight = platform.toUpperCase().includes('MAC') ? '16' : platform.toUpperCase().includes('WIN') ? '20' : '18';
// console.log(platform, IMEHeight);

searchInput.addEventListener('compositionstart', function() {
    const IME = savedValues['IME'] || IMEHeight; // 优先读取设置候选框高度 || mac的默认IME候选字号是16pt
    sugList.setAttribute('style', `--IME-m-t:${IME}pt; display: block;`); // 内联样式声明设定的高度, 显示建议词列表
    sugList.classList.add('IME'); // 添加候选框时的样式, 后续可以通过 sugList.classList.contains('IME') 来判读状态
});
searchInput.addEventListener('compositionend', function() {
    sugList.classList.remove('IME');
});


/// 建议词&搜索处理 ///


/// 天气 ///
function getWeather() {
    if (savedValues.weatherAPI) {
        fetch(savedValues.weatherAPI).then(response => response.text())
            .then(data => {
                document.getElementById('weather').textContent = `${data} ﹒`;
            })
            .catch(error => {
                document.getElementById('weather').textContent = '';
                console.error(error);
            });
    } else {
        // console.log('未定义天气');
        document.getElementById('weather').textContent = '';
    }
}
/// 天气 ///


/// 自定义设置处理 ///

function hidQ() {
    document.body.setAttribute('link-box-hid', document.body.getAttribute('link-box-hid') === '1' ? '0' : '1');
    switch (document.body.getAttribute('link-box-hid')) {
        case '1':
            document.querySelector('.link-box').classList.add('f_hidden');
            break;

        default:
            document.querySelector('.link-box').classList.remove('f_hidden');
            break;
    }
}; // 双击隐藏link-box

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

sug_select.addEventListener("change", () => {
    savedValues['sug_select'] = sug_select.value;
    localStorage.setItem("setting", JSON.stringify(savedValues));
});

let legacy = true;
const getFaviconUrl = (url, legacy = false) => legacy === false ? `https://www.google.com/s2/favicons?sz=256&domain=${url}` : `https://${url.split('/')[2]}/favicon.ico`;

function displayQuick(c = quick) {
    document.querySelector('.link-box').setAttribute(`style`, `--box-count:${c.length>2?Math.ceil(c.length/2):2}`);
    document.querySelector('.link-box').innerHTML = c.map((c, index) =>
        `<div class="card"><a href="${c.url}" id="link${index}" class="card-link" target="_blank"><div class="card-ti">${c.ti}</div><div class="card-desc">${c.desc}</div><img src="" name="${c.ico||getFaviconUrl(c.url)}" nameFavicon="${c.ico||getFaviconUrl(c.url,true)}" onerror="this.src='data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';" /></a></div>`).join('');
}

window.onload = async() => {
    displayBg(); // 显示背景
    displayQuick(); // 显示快速启动
    getWeather(); // 显示天气
    await displayIcons() // 显示图标
};

async function displayIcons() {
    const errorImgs = document.querySelectorAll('img[onerror]'); // 遍历所有带有 onerror 属性的 img 元素
    switch (savedValues.iconSrc) {
        case 'auto':
            try {
                const cdnResponse = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
                const cdnText = await cdnResponse.text();
                const cdnLines = cdnText.trim().split('\n');
                const cdnResult = {};
                cdnLines.forEach(line => {
                    const [key, value] = line.split('=');
                    cdnResult[key] = value;
                });
                console.log('Cloudflare CDN:', cdnResult.loc);
                switch (cdnResult.loc) {
                    case 'CN': // CN访问不了部分服务
                        // 遍历所有带有 onerror 属性的 img 元素
                        errorImgs.forEach((img) => {
                            const name = img.getAttribute('nameFavicon'); // 获取 img 元素的 name 属性值 
                            img.setAttribute('src', name); // 将 name 属性值赋值给 img 元素的 src 属性
                        });
                        break;

                    default:
                        errorImgs.forEach((img) => {
                            const name = img.getAttribute('name');
                            img.setAttribute('src', name);
                        });
                        break;
                }

            } catch (error) { // CDN 挂了就改成透明
                console.error(error);
                errorImgs.forEach((img) => {
                    img.setAttribute('src', 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='); // 改成透明
                });

            } // 显示图标
            break;

        case 'favicon':
            errorImgs.forEach((img) => {
                const name = img.getAttribute('nameFavicon'); // 获取 img 元素的 name 属性值 
                img.setAttribute('src', name); // 将 name 属性值赋值给 img 元素的 src 属性
            });
            break;

        case 'google':
            errorImgs.forEach((img) => {
                const name = img.getAttribute('name');
                img.setAttribute('src', name);
            });
            break;

        default:
            errorImgs.forEach((img) => {
                img.setAttribute('src', 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='); // 改成透明
            });
            break;
    }
}

labelSwitcher("search_engine");

function labelSwitcher(id) {
    const labelE = document.querySelector(`button[for="${id}"]`);
    const selectE = document.getElementById(id);

    let savedValue = savedValues[id];
    // console.log('存储值: ', savedValue); // 存储值

    if (savedValue === undefined) { // 未自定义搜索引擎时
        switch (navigator.language) {
            case 'zh-CN':
            case 'zh-cn':
                // 语言环境为简体中文
                savedValue = 'baidu';
                break;

            default:
                // 语言环境不是简体中文
                savedValue = 'google';
                break;
        }
    }
    labelE.innerText = document.querySelector(`option[value="${savedValue}"]`).innerText;
    selectE.value = savedValue;

    const index = Array.from(selectE.options).findIndex(option => option.value === savedValue);
    // console.log('savedIndex: ', index); // savedValue 索引

    let selectedIndex;

    if (index === -1) {
        // 如果没有找到该选项，则创建新选项并将其添加到<select>元素中
        const newOption = document.createElement("option");
        newOption.value = savedValue;
        newOption.text = "自定义";
        selectE.appendChild(newOption);
        newIndex = selectE.options.length - 1; // 新选项的索引为最后一个选项的索引

        console.log('newIndex: ', newIndex); // 新索引
        selectedIndex = newIndex;
        selectE.value = savedValue;
    } else {
        selectedIndex = index;
    }

    // 点击事件
    labelE.addEventListener("click", () => {
        selectedIndex++;
        if (selectedIndex >= selectE.options.length) {
            selectedIndex = 0;
        }

        selectE.selectedIndex = selectedIndex;

        labelE.innerText = selectE.options[selectedIndex].innerText;


        savedValues[id] = selectE.value;
        localStorage.setItem("setting", JSON.stringify(savedValues));
    });

    selectE.addEventListener("change", () => {
        labelE.innerText = document.querySelector(`option[value="${selectE.value}"]`).innerText;
        savedValues[id] = selectE.value;
        localStorage.setItem("setting", JSON.stringify(savedValues));
    });
}

if (savedValues['mask'] !== undefined) { // 背景遮罩
    setMask(savedValues['mask']);
    maskValue.value = savedValues['mask'];
}

function setMask(value, animate = null) { // 设置背景遮罩
    if (animate === null) {
        savedValues['mask'] = value;
        localStorage.setItem("setting", JSON.stringify(savedValues));
    }
    const opacity = 1 - parseFloat(value * 0.01);
    // console.log(value, opacity)

    const elements = document.querySelectorAll('.mask');
    elements.forEach((element) => {
        element.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    });
}

/// 自定义设置处理 ///


/// Tooltip ///
const TOOLTIP = document.querySelectorAll("[tooltip]");

if (TOOLTIP.length > 0) { // 判断是否有 tooltip 属性的El
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.setAttribute('id', 'tooltip');

    document.body.appendChild(tooltip); // 如果有则添加id 为 tooltip 的元素

    TOOLTIP.forEach(e => {
        const options = JSON.parse(e.getAttribute("tooltip"));

        e.addEventListener("mouseenter", () => {
            tooltip.innerHTML = options.content;
            tooltip.classList.add('active');

            if (options.delay) {
                setTimeout(() => {
                    tooltip.classList.remove('active');
                }, options.delay * 1000); // delay s后自动隐藏
            }
            e.setAttribute('aria-describedby', 'tooltip'); // 4 屏幕阅读器
        });

        e.addEventListener("mousemove", (e) => {
            const left = e.clientX + 10;
            const top = e.clientY + 10;

            if (left + tooltip.offsetWidth > window.innerWidth) {
                tooltip.style.left = "";
                tooltip.style.right = `${window.innerWidth - e.clientX + 10}px`;
            } else {
                tooltip.style.left = `${left}px`;
                tooltip.style.right = "";
            }

            if (top + tooltip.offsetHeight > window.innerHeight) {
                tooltip.style.top = `${e.clientY - tooltip.offsetHeight - 10}px`;
            } else {
                tooltip.style.top = `${top}px`;
            }
        }); // 越界处理

        e.addEventListener("mouseleave", () => {
            tooltip.classList.remove('active');
            e.removeAttribute('aria-describedby');
        });
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === "tooltip") {
                    const newTooltipOptions = JSON.parse(e.getAttribute("tooltip"));
                    options.content = newTooltipOptions.content;
                    options.delay = newTooltipOptions.delay;
                }
            });
        });

        observer.observe(e, {
            attributes: true
        });
    });
}
/// Tooltip ///


/// 用于设置的 dialog ///
const openDialog = (url, height) => {
    // 创建遮罩层
    const mask = document.createElement("div");
    mask.style.position = "fixed";
    mask.style.top = "0";
    mask.style.bottom = "0";
    mask.style.left = "0";
    mask.style.right = "0";
    mask.style.backgroundColor = "transparent";
    mask.style.zIndex = "9999";

    // 检查对话框是否已经存在
    let dialog = document.querySelector(".dialog");
    if (!dialog) {
        // 创建对话框
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");
        mask.appendChild(dialog);

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.position = "absolute";
        closeBtn.style.left = '-40px';
        closeBtn.style.top = '-5px';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.padding = '10px';
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#999';
        closeBtn.style.border = 'none';
        closeBtn.style.cursor = 'pointer';

        // 创建 iframe 并加载网址
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = 'none';
        iframe.style.boxShadow = '0 0 9px rgba(0, 0, 0, 0.15)';
        dialog.appendChild(iframe);
        dialog.appendChild(closeBtn);
    }

    document.body.appendChild(mask);


    // 给遮罩层绑定点击事件，点击遮罩层关闭对话框
    mask.addEventListener("click", () => {
        document.body.removeChild(mask);
    });
};
setting.addEventListener("click", () => {
    openDialog('./settings.html', 400);
});
/// 用于设置的 dialog ///


/// 右键选单 ///
const copyIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const newtabIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"></circle></svg>`
const setIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="3" x2="8" y2="9"></line><line x1="16" y1="15" x2="16" y2="21"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`
const cutIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
const pasteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
const downloadIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const deleteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const moveIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12v2L9 16v2h12"/></svg>`;
const editIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l4 4-9.9 9.9-5 1 1-5 9.9-9.9z"/><path d="M4 22h18"/></svg>`;
const addIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const hidIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8a4 4 0 0 0 0 8v-4z" fill="currentColor" transform="rotate(30, 12, 12)"/></svg>`;

let newTabUrl = null;
let newTabID = null;

const isHttpUrl = (url) => /^https?:\/\//i.test(url);

const quickOpen = async() => {
    try {
        const clipboardText = await navigator.clipboard.readText();
        const url = clipboardText.trim();
        if (isHttpUrl(url)) {
            window.open(url, '_blank', 'noopener')
        } else {
            searchKey(url);
        }
    } catch (error) {
        console.error('无法获取剪切板', error);
    }
};

class ContextMenu {
    constructor({ menuItems = [], longPressDuration = 800 }) {
        this.menuItems = menuItems;
        this.menuItemsNode = this.getMenuItemsNode();
        this.isOpened = false;
        this.longPressDuration = longPressDuration;
        this.longPressTimer = null;
    }

    getMenuItemsNode() {
        const nodes = [];

        if (!this.menuItems) {
            console.error("getMenuItemsNode :: Please enter menu items");
            return [];
        }

        this.menuItems.forEach((data, index) => {
            const item = this.createItemMarkup(data);
            item.firstChild.setAttribute(
                "style",
                `animation-delay: .27s`
            );

            nodes.push(item);
        });

        return nodes;
    }

    createItemMarkup(data) {
        const button = document.createElement("BUTTON");
        const item = document.createElement("LI");

        button.innerHTML = data.content;
        button.classList.add("contextMenu-button");
        item.classList.add("contextMenu-item");

        if (data.divider) item.setAttribute("data-divider", data.divider);
        item.appendChild(button);

        if (data.events && data.events.length !== 0) {
            Object.entries(data.events).forEach((event) => {
                const [key, value] = event;
                button.addEventListener(key, value);
            });
        }

        return item;
    }

    renderMenu() {
        const menuContainer = document.createElement("UL");

        menuContainer.classList.add("contextMenu");

        const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
        menuContainer.setAttribute("data-theme", isDarkMode ? "dark" : "light");

        this.menuItemsNode.forEach((item) => menuContainer.appendChild(item));

        return menuContainer;
    }

    closeMenu(menu) {
        if (this.isOpened) {
            this.isOpened = false;
            menu.remove();
        }
    }

    getTargetElement(e) {
        let target = e.target;

        while (target && target.tagName !== 'BODY') {
            switch (true) {
                case target.classList.contains('class-name-1'):
                    return target;
                case target.classList.contains('class-name-2'):
                    return target;
                default:
                    target = target.parentNode;
            }
        }

        return null; // 没有匹配到相应元素时返回 null
    }

    init() {
        const contextMenu = this.renderMenu();
        document.addEventListener("click", () => this.closeMenu(contextMenu));
        window.addEventListener("blur", () => this.closeMenu(contextMenu));
        document.addEventListener("contextmenu", (e) => {
            contextMenu.remove();
        });
        const hidCMItems = (indexes, addClass) => {
            const elements = document.querySelectorAll(".contextMenu-item");
            indexes.forEach(index => {
                if (elements[index]) {
                    switch (addClass) {
                        case false:
                            elements[index].classList.remove('hidden');
                            break;
                        default:
                            elements[index].classList.add('hidden');
                    }
                } else {
                    console.log(`索引号不存在: ${index} `);
                }
            });
        }; // 根据索引号隐藏菜单

        document.addEventListener("contextmenu", (e) => {
            if (!e.target.closest("dialog")) { // 不在 dialog 元素或子元素上
                e.preventDefault();
                this.isOpened = true;

                const { clientX, clientY } = e;
                document.body.appendChild(contextMenu);

                const positionY =
                    clientY + contextMenu.scrollHeight >= window.innerHeight ?
                    window.innerHeight - contextMenu.scrollHeight - 20 :
                    clientY;
                const positionX =
                    clientX + contextMenu.scrollWidth >= window.innerWidth ?
                    window.innerWidth - contextMenu.scrollWidth - 20 :
                    clientX;


                const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
                contextMenu.setAttribute("data-theme", isDarkMode ? "dark" : "light");

                contextMenu.setAttribute(
                    "style",
                    `--width: ${contextMenu.scrollWidth}px;
               --top: ${positionY}px;
               --left: ${positionX}px;`
                );

                // 获取元素类名数组
                const elements = document.elementsFromPoint(clientX, clientY);

                // const classNames = [];
                // elements.forEach((element) => {
                //     if (element.tagName !== "BODY") {
                //         classNames.push(element.className);
                //     }
                // });
                // console.log(classNames);

                hidCMItems([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], true); // 隐藏
                // 0 新标签页打开
                // 1 编辑 Edit
                // 2 移动 Move
                // 3 删除 Remove

                // 4 打开剪切板 Open the clipboard

                // 5 拷贝 Copy
                // 6 剪切 Cut
                // 7 粘贴 Paste
                // 8 添加快速启动 Add Quick Launch
                // if (elements.find(element => element.tagName === 'DIALOG')) {
                //     console.log('1');
                // }
                if (elements.find(element => element.tagName === 'A')) {
                    newTabID = elements.find(element => element.tagName === 'A').getAttribute('id'); // 获取 index 值
                    newTabUrl = elements.find(element => element.tagName === 'A').getAttribute('href'); // 获取 href 值, 必须.getAttribute, 直接.href会加`\`
                    hidCMItems([0, 1, 2, 3], false);
                } else if (elements.find(element => element.tagName === 'INPUT')) {
                    newTabUrl = null;
                    hidCMItems([4, 5, 6, 7], false); // 不隐藏
                } else {
                    hidCMItems([4, 8, 9], false); // 不隐藏
                }
                // 

                if (quick.length > 7) { // 快速启动设置限制，最多8个
                    hidCMItems([8], true); // 不隐藏
                }
            }


        });

        // 深色模式
        const darkChange = window.matchMedia("(prefers-color-scheme: dark)");
        const handleThemeChange = (e) => {
            const isDarkMode = e.matches;
            contextMenu.setAttribute("data-theme", isDarkMode ? "dark" : "light");
        };

        darkChange.addEventListener("change", handleThemeChange);
    }
} // 参考 https://codepen.io/knyttneve/pen/YzxEBew

function menuinit() {
    const contextMenu = new ContextMenu({
        menuItems: [{
                content: `${newtabIcon} ${i18next.t('openIn')}`,
                events: {
                    click: () => (
                        newTabUrl !== null && window.open(newTabUrl, '_blank', 'noopener'), newTabUrl = null
                    )
                }
            }, {
                content: `${editIcon} ${i18next.t('edit')}`,
                events: {
                    click: (e) => (
                        sc_setting(newTabUrl)
                    )
                }
            }, {
                content: `${moveIcon} ${i18next.t('move')} `,
                events: {
                    click: () => (
                        draggableAll()
                    )
                }
            }, {
                content: `${deleteIcon} ${i18next.t('delete')}`,
                events: {
                    click: () => (
                        delQuick(newTabID)
                    )
                }
            }, {
                content: `${newtabIcon} ${i18next.t('open_clipboard')}`,
                events: {
                    click: () => (
                        quickOpen()
                    )
                }
            },
            { content: `${copyIcon} ${i18next.t('copy')}`, events: { click: () => (document.execCommand('copy')) } },
            { content: `${cutIcon} ${i18next.t('cut')}`, events: { click: () => (document.execCommand("cut")) } },
            {
                content: `${pasteIcon} ${i18next.t('paste')}`,
                events: {
                    click: () => (
                        navigator.clipboard.readText().then(text => search_input.value = text))
                }
            },
            {
                content: `${addIcon} ${i18next.t('addQ')}`,
                divider: "top", // top, bottom, top-bottom
                events: {
                    click: () => (
                        sc_setting()
                    )
                }
            },
            {
                content: `${hidIcon} ${i18next.t('View Toggle')}`,
                events: {
                    click: () => (
                        hidQ()
                    )
                }
            },
            {
                content: `${setIcon} ${i18next.t('settings')} 🔨`,
                divider: "top", // top, bottom, top-bottom
                events: {
                    click: () => (
                        openDialog('./settings.html', 400)
                    )
                }
            }
        ],
    });
    contextMenu.init();
}

/// 右键选单 ///


/// 编辑快速启动 ///
const sc_setting = (original_url = '') => {
    dialog = document.createElement('dialog');
    dialog.id = 'shortcut_setting';
    dialog.innerHTML = `
    <form id="dialog_form">
    <label for="dialog_url">${i18next.t('URL')}:</label>
    <input type="text" id="dialog_url" autocomplete="off" spellcheck="false" value="${original_url}" pattern=".*:\/\/.*" required><br>
    <label for="dialog_ti">${i18next.t('Title')}:</label>
    <input type="text" id="dialog_ti" autocomplete="off" spellcheck="false" value="${original_url===''?'':findQuick(original_url)['ti']}"><br>
    <label for="dialog_desc">${i18next.t('Description')}:</label>
    <input type="text" id="dialog_desc" autocomplete="off" spellcheck="false" value="${original_url===''?'':findQuick(original_url)['desc']}"><br>
    <div><button type="submit">${i18next.t('Save')}</button><button onclick="shortcut_setting.remove()">${i18next.t('Cancel')}</button></div>
    </form>`;

    document.body.appendChild(dialog);
    const form = document.getElementById('dialog_form');
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // 阻止表单默认行为
        const title = document.getElementById('dialog_ti').value;
        const description = document.getElementById('dialog_desc').value;
        const url = document.getElementById('dialog_url').value;
        // 处理表单数据
        let newquick;
        if (original_url) {
            newquick = updateQuick(newTabID, { 'ti': title, 'desc': description, 'url': url });
        } else {
            newquick = addNewQuick({ 'ti': title, 'desc': description, 'url': url });
        }
        displayQuick(newquick);

        savedValues['sug_quick'] = newquick; // 更新新设置的快速启动
        localStorage.setItem("setting", JSON.stringify(savedValues));

        shortcut_setting.remove(); // 关闭对话框
    });
    dialog.showModal();
};
/// 编辑快速启动 ///


/// 背景处理 ///

// 监听深色模式
// const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// // 当匹配状态更改时，调用回调函数
// darkModeMediaQuery.addListener((e) => {
//     if (e.matches) {
//         // 处理深色模式
//         const elements = document.querySelectorAll('.bg');
//         elements.forEach((element) => {
//             element.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
//         });
//     } else {
//         // 处理浅色模式
//         console.log('浅色模式已启用');
//     }
// });
video.onplay = function() {
    setTimeout(() => {
        video.style.opacity = 1;
    }, 1000);
}

function displayBg() {
    switch (savedValues.bgMode) {
        case 'vid':
            vid(); // 载入影片, 显示一张透明图
            video.setAttribute('poster', transparentPic);
            document.addEventListener("visibilitychange", function() { // 当用户离开页面时, 暂停播放
                const E = document.querySelectorAll('.bg');
                switch (document.visibilityState) {
                    case 'visible': // 返回标签页
                        setTimeout(() => {
                            E.forEach((e) => {
                                e.removeAttribute('style')
                            });
                            setTimeout(() => {
                                video.play();
                            }, 700);
                        }, 300);
                        break;
                    case 'hidden': // 离开标签页
                        E.forEach((e) => {
                            e.setAttribute('style', 'opacity: 0;')
                        });
                        video.pause();
                        break;
                }
            })
            break;
        case 'pic':
        default:
            pic();
            video.style.opacity = 1;
            break;
    }
}

function pic() {

    const indexedDB = window.indexedDB;

    video.pause();
    video.classList.add('hid');
    document.getElementById('canvas').classList.add('hid');
    video.src = '';
    picture.classList.remove('hid');
    let imgsTimer;

    const imgsRequest = indexedDB.open('images-db', 1);
    let imgsDb;

    imgsRequest.onupgradeneeded = event => {
        imgsDb = event.target.result;
        imgsDb.createObjectStore('images');
        imgsDb.createObjectStore('preview');
    };

    imgsRequest.onerror = event => {
        console.error('图片数据库错误:', event.target.error);
    };

    imgsRequest.onsuccess = event => {
        imgsDb = event.target.result;

        clearInterval(imgsTimer);
        const urls = [];

        const objectStore = imgsDb.transaction('images', 'readonly').objectStore('images');
        const request = objectStore.getAll();

        request.onsuccess = event => {
            const blobs = event.target.result;
            picture.style.opacity = 1;

            if (blobs.length > 0) {
                blobs.forEach(blob => {
                    urls.push(URL.createObjectURL(blob));
                });
                // video.setAttribute('poster', urls[0]); // 显示第一张图像
                picture.src = urls[0];


                if (urls.length > 1) {
                    let currentIndex = 1;
                    const intervalSeconds = 5; // 60s切换下一张

                    console.log(urls)

                    imgsTimer = setInterval(() => {
                        // video.setAttribute('poster', urls[currentIndex]);
                        picture.src = urls[currentIndex];
                        currentIndex = (currentIndex + 1) % urls.length;
                    }, intervalSeconds * 1000); // 循环放图

                }
            } else {
                let defaultPic = './static/img/pexels-no-name-66997.jpg';
                picture.src = defaultPic;
                video.setAttribute('poster', defaultPic); // 没有

                // video.setAttribute('poster', 'https://source.unsplash.com/random/2048×1080?creative,abstract');
            }
        };

        request.onerror = event => {
            console.error('图片数据库错误', event.target.error);
        };

    };

}


function vid() {
    video.classList.remove('hid');
    document.getElementById('canvas').classList.remove('hid');
    picture.src = transparentPic;
    picture.classList.add('hid');
    const indexedDB = window.indexedDB;

    const request = indexedDB.open('videos-db', 1);

    request.onupgradeneeded = event => {
        const db = event.target.result;
        db.createObjectStore('videos');
    };

    request.onerror = event => {
        console.error('影片数据库错误:', event.target.error);
    };

    request.onsuccess = event => {
        const db = event.target.result;
        const blobUrls = [];

        const transaction = db.transaction('videos', 'readonly');
        const objectStore = transaction.objectStore('videos');

        const request = objectStore.openCursor();
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const blob = cursor.value;
                const url = URL.createObjectURL(blob);
                blobUrls.push(url);
                cursor.continue();
            } else {
                if (blobUrls.length > 0) {
                    let currentIndex = 0;
                    video.src = blobUrls[currentIndex];

                    video.addEventListener('ended', () => {
                        currentIndex = (currentIndex + 1) % blobUrls.length;
                        video.src = blobUrls[currentIndex];
                    });
                } else {
                    video.src = '';
                    pic(); // 没有影片切换到图片模式
                    savedValues.bgMode = 'pic';
                    localStorage.setItem("setting", JSON.stringify(savedValues)); // 保存为图片模式

                    video.style.opacity = 1;
                }
            }
        };

        request.onerror = event => {
            console.error('IndexedDB error:', event.target.error);
        };

    };
    const canvas = document.getElementById('canvas');
    const cap = canvas.getContext('2d');
    // const video = document.getElementById('video');
    video.addEventListener('play', () => {
        const loop = () => {
            if (!video.paused && !video.ended) {
                cap.drawImage(video, 0, 0, canvas.width, canvas.height);
                setTimeout(loop, 1000 / 24);
            }
        };
        loop();
    }, 0);
}

/// 背景处理 ///


/// 移动 ///
class Banner {
    constructor(content, buttons) {
        this.content = content;
        this.buttons = buttons;
        this.createBanner();
    }

    createBanner() {
        // 创建横幅元素和样式
        const banner = document.createElement('div');
        banner.style.display = 'flex';
        banner.style.zIndex = '1';
        banner.style.justifyContent = 'space-between';
        banner.style.position = 'fixed';
        banner.style.bottom = 0;
        banner.style.backdropFilter = 'blur(6px)'
        banner.style.width = '100%';
        banner.style.backgroundColor = '#33333366';
        banner.style.color = 'white';
        banner.style.padding = '0';

        // 添加横幅内容
        const content = document.createElement('p');
        content.innerHTML = this.content;
        content.style.paddingLeft = '18px';
        banner.appendChild(content);

        // 添加按钮组容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.paddingRight = '18px';
        buttonContainer.style.justifyContent = 'flex-end';
        banner.appendChild(buttonContainer);

        // 添加按钮
        this.buttons.forEach((button, index) => {
            const buttonElement = document.createElement('button');
            buttonElement.innerText = button.text;
            buttonElement.style.padding = '18px';
            if (index === 1) {
                buttonElement.style.backgroundColor = '#33333399'
            } else {
                buttonElement.style.backgroundColor = '#00000011'
            }
            buttonElement.style.border = '0'
            buttonElement.style.color = 'white'
            buttonElement.onclick = button.onclick;
            buttonContainer.appendChild(buttonElement);
        });

        // 添加到页面顶部
        document.body.insertBefore(banner, document.body.firstChild);
        // 保存 banner 元素的引用，以便稍后销毁它
        this.bannerElement = banner;
    }
    destroyBanner() {
        if (this.bannerElement) {
            this.bannerElement.remove();
            this.bannerElement = null;
        }
    }
}

const cancelDrag = () => {
    banner.destroyBanner();
    removeEditStyle();
};
const saveDrag = () => {
    const linkElements = document.querySelectorAll('.card-link');
    // 将所有card-link的id提取出来，然后去掉文字部分，转数字型组成新index数组用于排序
    const newIndices = Array.from(linkElements).map((e) => Number(e.id.replace('link', '')));
    quick = newIndices.map((index) => quick[index]).reduce((acc, cur) => {
        acc.push(cur);
        return acc;
    }, []);
    // console.log('新顺序', quick);
    savedValues['sug_quick'] = quick; // 更新新顺序的快速启动
    localStorage.setItem("setting", JSON.stringify(savedValues)); // 保存设置
    removeEditStyle();
    banner.destroyBanner(); // 销毁 banner
};

class Draggable {
    constructor(options) {
        this.parent = options.element; // 父级元素
        this.cloneElementClassName = options.cloneElementClassName;
        this.isPointerdown = false;
        this.diff = {
            x: 0,
            y: 0
        };
        this.drag = {
            element: null,
            index: 0,
            lastIndex: 0
        }; // 拖拽元素
        this.drop = {
            element: null,
            index: 0,
            lastIndex: 0
        }; // 释放元素
        this.clone = {
            element: null,
            x: 0,
            y: 0
        };
        this.lastPointermove = {
            x: 0,
            y: 0
        };
        this.rectList = [];
        this.init();
    }
    init() {
            this.getRect();
            this.bindEventListener();
        }
        // 获取元素位置信息
    getRect() {
        this.rectList.length = 0;
        for (const item of this.parent.children) {
            this.rectList.push(item.getBoundingClientRect());
        }
    }
    handlePointerdown(e) {
        // 如果是鼠标点击，只响应左键
        if (e.pointerType === 'mouse' && e.button !== 0) {
            return;
        }
        if (e.target === this.parent) {
            return;
        }
        this.isPointerdown = true;
        this.parent.setPointerCapture(e.pointerId);
        this.lastPointermove.x = e.clientX;
        this.lastPointermove.y = e.clientY;
        this.drag.element = e.target;
        this.drag.element.classList.add('active');
        this.clone.element = this.drag.element.cloneNode(true);
        this.clone.element.className = this.cloneElementClassName;
        this.clone.element.style.transition = 'none';
        const i = [].indexOf.call(this.parent.children, this.drag.element);
        this.clone.x = this.rectList[i].left;
        this.clone.y = this.rectList[i].top;
        this.drag.index = i;
        this.drag.lastIndex = i;
        this.clone.element.style.transform = 'translate3d(' + this.clone.x + 'px, ' + this.clone.y + 'px, 0)';
        document.body.appendChild(this.clone.element);
    }
    handlePointermove(e) {
        if (this.isPointerdown) {
            this.diff.x = e.clientX - this.lastPointermove.x;
            this.diff.y = e.clientY - this.lastPointermove.y;
            this.lastPointermove.x = e.clientX;
            this.lastPointermove.y = e.clientY;
            this.clone.x += this.diff.x;
            this.clone.y += this.diff.y;
            this.clone.element.style.transform = 'translate3d(' + this.clone.x + 'px, ' + this.clone.y + 'px, 0)';
            for (let i = 0; i < this.rectList.length; i++) {
                // 碰撞检测
                if (i !== this.drag.index && e.clientX > this.rectList[i].left && e.clientX < this.rectList[i].right &&
                    e.clientY > this.rectList[i].top && e.clientY < this.rectList[i].bottom) {
                    this.drop.element = this.parent.children[i];
                    this.drop.lastIndex = i;
                    if (this.drag.element !== this.drop.element) {
                        if (this.drag.index < i) {
                            this.parent.insertBefore(this.drag.element, this.drop.element.nextElementSibling);
                            this.drop.index = i - 1;
                        } else {
                            this.parent.insertBefore(this.drag.element, this.drop.element);
                            this.drop.index = i + 1;
                        }
                        this.drag.index = i;
                        const dragRect = this.rectList[this.drag.index];
                        const lastDragRect = this.rectList[this.drag.lastIndex];
                        const dropRect = this.rectList[this.drop.index];
                        const lastDropRect = this.rectList[this.drop.lastIndex];
                        this.drag.lastIndex = i;
                        this.drag.element.style.transition = 'none';
                        this.drop.element.style.transition = 'none';
                        this.drag.element.style.transform = 'translate3d(' + (lastDragRect.left - dragRect.left) + 'px, ' + (lastDragRect.top - dragRect.top) + 'px, 0)';
                        this.drop.element.style.transform = 'translate3d(' + (lastDropRect.left - dropRect.left) + 'px, ' + (lastDropRect.top - dropRect.top) + 'px, 0)';
                        this.drag.element.offsetLeft; // 触发重绘
                        this.drag.element.style.transition = 'transform 150ms';
                        this.drop.element.style.transition = 'transform 150ms';
                        this.drag.element.style.transform = 'translate3d(0px, 0px, 0px)';
                        this.drop.element.style.transform = 'translate3d(0px, 0px, 0px)';
                    }
                    break;
                }
            }
        }
    }
    handlePointerup(e) {
        if (this.isPointerdown) {
            this.isPointerdown = false;
            this.drag.element.classList.remove('active');
            this.clone.element.remove();
        }
    }
    handlePointercancel(e) {
        if (this.isPointerdown) {
            this.isPointerdown = false;
            this.drag.element.classList.remove('active');
            this.clone.element.remove();
        }
    }
    bindEventListener() {
        this.handlePointerdown = this.handlePointerdown.bind(this);
        this.handlePointermove = this.handlePointermove.bind(this);
        this.handlePointerup = this.handlePointerup.bind(this);
        this.handlePointercancel = this.handlePointercancel.bind(this);
        this.getRect = this.getRect.bind(this);
        this.parent.addEventListener('pointerdown', this.handlePointerdown);
        this.parent.addEventListener('pointermove', this.handlePointermove);
        this.parent.addEventListener('pointerup', this.handlePointerup);
        this.parent.addEventListener('pointercancel', this.handlePointercancel);
        window.addEventListener('scroll', this.getRect);
        window.addEventListener('resize', this.getRect);
        window.addEventListener('orientationchange', this.getRect);
    }
    unbindEventListener() {
        this.parent.removeEventListener('pointerdown', this.handlePointerdown);
        this.parent.removeEventListener('pointermove', this.handlePointermove);
        this.parent.removeEventListener('pointerup', this.handlePointerup);
        this.parent.removeEventListener('pointercancel', this.handlePointercancel);
        window.removeEventListener('scroll', this.getRect);
        window.removeEventListener('resize', this.getRect);
        window.removeEventListener('orientationchange', this.getRect);
    }

    destroy() {
        this.parent.removeEventListener('pointerdown', this.handlePointerdown);
        document.removeEventListener('pointermove', this.handlePointermove);
        document.removeEventListener('pointerup', this.handlePointerup);
        document.removeEventListener('pointercancel', this.handlePointercancel);
    }; // 取消Draggable
}
// Draggable 实现参考 https://juejin.cn/post/7022824391163510821

let draggable;
let banner;

const draggableAll = () => {
    addEditStyle(); // 添加样式
    setTimeout(() => {
        draggable = new Draggable({
            element: document.querySelector('.link-box'),
            cloneElementClassName: 'clone-card'
        });
        const cards = document.querySelectorAll('.card');
        cards.forEach(c => {
            c.classList.add('cursor');
        }); // 添加鼠标样式
    }, 600);
    banner = new Banner(`<b>[${i18next.t('drag_mode')}]</b> ${i18next.t('drag_tip')}`, [
        { text: i18next.t('Cancel'), onclick: cancelDrag },
        { text: i18next.t('Save'), onclick: saveDrag }
    ]);

};

// 添加样式
const removeEditStyle = () => {
    const styleToRemove = document.getElementById('edit_styles');
    if (styleToRemove) {
        styleToRemove.parentNode.removeChild(styleToRemove);
        draggable.destroy();
    } // 删除 样式

    const E = document.querySelector('.link-box').querySelectorAll('.disabled');
    E.forEach(e => {
        e.classList.remove('disabled');
    }); // 移除所有 disabled类
    const cards = document.querySelectorAll('.card');
    cards.forEach(c => {
        c.classList.add('cursor');
    }); // 移除 鼠标样式
};

const addEditStyle = () => {
    [...document.querySelectorAll('.card, .card-link')].forEach(
        box => box.classList.add('disabled')
    ); // 添加 disabled类


    if (document.getElementById('edit_styles')) {
        return;
    } // 判断是否已有

    const style = document.createElement('style');
    style.id = 'edit_styles';
    style.innerHTML = `
    * { 
        touch-action: none;
        -webkit-user-select: none!important;
        user-select: none!important;
    }
    .active {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
    }
    .clone-card {
        display: none;
    }
    .card-link.disabled {
        cursor: default;
        pointer-events: none;
        text-decoration: none;
        color: gray;
    }
    .card.disabled {
        height: auto;
    }
    .card.cursor {
        cursor: move;
    }
    .card-tit{
        color: #8bc34a;
        transition: all .45s ease-in;
    }
    @media (max-width:840px) {
        .card-link.disabled {
            height: 32px;
            border-radius: 3px;
            font-size: 16px;
            padding: 0 0 0 16px;
            transition: all .3s ease-in;
        }
        .card-ti {
            font-size:18px
        }
        .search{
            display:none;
        }
        .link-box {
            margin-top: 72px;
        }
        .card-desc {
            display:none;
        }
        .card-link img {
            bottom: 1px;
            right: 12px;
        }
    }`;
    document.head.appendChild(style);
};
/// 移动 ///