const $ = (id) => document.getElementById(id);

const FALLBACK_LISTING = {
  name: '浊鸷 VPM Listing',
  url: 'https://zhuozhi233.github.io/vpm-listing/index.json',
  author: {
    name: '浊鸷',
    url: 'https://github.com/zhuozhi233'
  },
  githubRepos: [
    'zhuozhi233/LyumaShader-Extended',
    'zhuozhi233/lilToon-Distance-Visibility',
    'zhuozhi233/MA2BT-Pro'
  ],
  packages: [
    {
      id: 'com.zhuozhi.lyumashader-extended',
      displayName: 'LyumaShader 扩展版',
      description: '为 LyumaShader Waifu2d 增加 lilToon、Poiyomi、NDMF 非破坏式配置与批量处理支持。'
    },
    {
      id: 'com.zhuozhi.liltoon-distance-visibility',
      displayName: 'lilToon 距离显示',
      description: '为指定的 lilToon 材质添加可配置的近端、远端和区间距离显示，并支持抖动过渡与一键还原。'
    },
    {
      id: 'com.zhuozhi.ma2bt-pro',
      displayName: 'MA2BT Pro',
      description: '将 Modular Avatar 响应式组件转换为 BlendTree，减少 Animator Layer 数量，优化 Avatar 性能。'
    }
  ]
};

function showToast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $('toast').classList.remove('show'), 1300);
}

async function readJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { cache: 'default', signal: controller.signal });
    if (!res.ok) throw new Error(url);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function hasPackages(packages) {
  if (Array.isArray(packages)) return packages.length > 0;
  return packages && typeof packages === 'object' && Object.keys(packages).length > 0;
}

async function loadListing() {
  const indexData = await readJson('./index.json');
  const listing = { ...FALLBACK_LISTING, ...indexData };
  listing.name = indexData.name || FALLBACK_LISTING.name;
  listing.url = indexData.url || FALLBACK_LISTING.url;
  listing.author = indexData.author || FALLBACK_LISTING.author;
  listing.githubRepos = indexData.githubRepos?.length ? indexData.githubRepos : FALLBACK_LISTING.githubRepos;
  listing.packages = hasPackages(indexData.packages) ? indexData.packages : FALLBACK_LISTING.packages;
  return listing;
}

function displayTitle(name) {
  return name.replace(/\s*VPM Listing$/i, ' Packages');
}

function authorName(author) {
  return typeof author === 'string' ? author : (author?.name || '');
}

function authorUrl(author) {
  return typeof author === 'object' ? author.url : '';
}

function compareVersion(a, b) {
  const pa = String(a).split(/[.-]/).map(Number);
  const pb = String(b).split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return String(a).localeCompare(String(b));
}

function packageListFrom(packages) {
  if (Array.isArray(packages)) return packages;

  return Object.entries(packages || {}).map(([id, item]) => {
    const versions = item.versions || {};
    const version = Object.keys(versions).sort(compareVersion).at(-1);
    const manifest = version ? versions[version] : item;

    return {
      id,
      name: manifest.displayName || manifest.name || item.displayName || id,
      description: manifest.description || item.description || ''
    };
  });
}

function repoUrl(repo) {
  return repo ? `https://github.com/${repo}` : '';
}

function repoName(repo) {
  return repo ? repo.split('/').pop() : '';
}

function repoForPackage(pkg, repos) {
  if (!repos.length) return '';
  if (repos.length === 1) return repos[0];

  const text = `${pkg.id || ''} ${pkg.name || ''}`.toLowerCase();
  return repos.find((repo) => text.includes(repoName(repo).toLowerCase())) || repos[0];
}

function createButton(text, href, primary) {
  const a = document.createElement('a');
  a.className = primary ? 'button primary' : 'button';
  a.textContent = text;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

async function repoDescription(repo) {
  try {
    const data = await readJson(`https://api.github.com/repos/${repo}`);
    return data.description || '';
  } catch {
    return '';
  }
}

function renderPackage(pkg, repo, listingUrl) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div>
      <h3 class="card-title"></h3>
      <p class="card-desc"></p>
      <div class="card-url"></div>
    </div>
    <div class="card-actions"></div>
  `;

  const title = pkg.displayName || pkg.name || pkg.id || repoName(repo);
  const githubUrl = repoUrl(repo);

  card.querySelector('.card-title').textContent = title;
  card.querySelector('.card-desc').textContent = pkg.description || '';
  card.querySelector('.card-url').textContent = githubUrl;

  if (!pkg.description && repo) {
    repoDescription(repo).then((text) => {
      card.querySelector('.card-desc').textContent = text;
    });
  }

  const actions = card.querySelector('.card-actions');
  if (listingUrl) actions.append(createButton('Add to VCC', `vcc://vpm/addRepo?url=${encodeURIComponent(listingUrl)}`, true));
  if (githubUrl) actions.append(createButton('Open on GitHub', githubUrl, false));

  return card;
}

function renderPackages(listing) {
  const repos = listing.githubRepos || [];
  const packages = packageListFrom(listing.packages);

  const cards = packages.length
    ? packages.map((pkg) => renderPackage(pkg, repoForPackage(pkg, repos), listing.url))
    : repos.map((repo) => renderPackage({ name: repoName(repo) }, repo, listing.url));

  $('packagesSection').hidden = cards.length === 0;
  $('packagesList').replaceChildren(...cards);

  $('searchInput').oninput = () => {
    const keyword = $('searchInput').value.trim().toLowerCase();
    const filtered = packages.length
      ? packages.filter((pkg) => `${pkg.displayName || ''} ${pkg.name || ''} ${pkg.id || ''} ${pkg.description || ''}`.toLowerCase().includes(keyword))
      : repos.filter((repo) => repo.toLowerCase().includes(keyword));

    const newCards = packages.length
      ? filtered.map((pkg) => renderPackage(pkg, repoForPackage(pkg, repos), listing.url))
      : filtered.map((repo) => renderPackage({ name: repoName(repo) }, repo, listing.url));

    $('packagesList').replaceChildren(...newCards);
  };
}

function applyListing(listing) {
  const title = displayTitle(listing.name);
  const name = authorName(listing.author);
  const url = authorUrl(listing.author);

  document.title = title;
  $('listingName').textContent = title;
  $('listingUrl').value = listing.url;
  $('addRepo').href = `vcc://vpm/addRepo?url=${encodeURIComponent(listing.url)}`;

  $('authorLine').textContent = 'Published by ';
  if (name) {
    const author = document.createElement(url ? 'a' : 'span');
    author.textContent = name;
    if (url) {
      author.href = url;
      author.target = '_blank';
      author.rel = 'noopener';
    }
    $('authorLine').append(author);
  }

  $('copyUrl').onclick = () => {
    navigator.clipboard.writeText(listing.url).then(() => showToast('已复制 Listing URL'));
  };

  renderPackages(listing);
}

function showLoadError() {
  const status = $('packagesStatus');
  status.textContent = '最新数据暂时无法加载，当前显示基本软件包信息。';

  const retry = document.createElement('button');
  retry.className = 'retry-button';
  retry.textContent = '重试';
  retry.onclick = refreshListing;
  status.append(retry);
}

async function refreshListing() {
  $('packagesStatus').textContent = '正在检查最新软件包信息…';

  try {
    const listing = await loadListing();
    applyListing(listing);
    $('packagesStatus').textContent = '';
  } catch (err) {
    console.error(err);
    showLoadError();
  }
}

applyListing(FALLBACK_LISTING);
refreshListing();
