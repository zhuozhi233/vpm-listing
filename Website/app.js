const $ = (id) => document.getElementById(id);

function showToast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $('toast').classList.remove('show'), 1300);
}

async function readJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function firstJson(paths) {
  for (const path of paths.filter(Boolean)) {
    try { return await readJson(path); } catch {}
  }
  return {};
}

function rawSourceUrl() {
  if (!location.hostname.endsWith('.github.io')) return '';
  const owner = location.hostname.replace('.github.io', '');
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/main/source.json` : '';
}

function hasPackages(packages) {
  if (Array.isArray(packages)) return packages.length > 0;
  return packages && typeof packages === 'object' && Object.keys(packages).length > 0;
}

async function loadListing() {
  const indexData = await firstJson(['./index.json', './source.json', '../source.json']);
  const sourceData = await firstJson(['./source.json', '../source.json', rawSourceUrl()]);

  const listing = { ...sourceData, ...indexData };
  listing.name = sourceData.name || indexData.name || 'VPM Listing';
  listing.url = sourceData.url || indexData.url || '';
  listing.author = sourceData.author || indexData.author || {};
  listing.infoLink = sourceData.infoLink || indexData.infoLink;
  listing.githubRepos = sourceData.githubRepos || indexData.githubRepos || [];
  listing.packages = hasPackages(indexData.packages) ? indexData.packages : (sourceData.packages || []);
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

  $('searchInput').addEventListener('input', () => {
    const keyword = $('searchInput').value.trim().toLowerCase();
    const filtered = packages.length
      ? packages.filter((pkg) => `${pkg.displayName || ''} ${pkg.name || ''} ${pkg.id || ''} ${pkg.description || ''}`.toLowerCase().includes(keyword))
      : repos.filter((repo) => repo.toLowerCase().includes(keyword));

    const newCards = packages.length
      ? filtered.map((pkg) => renderPackage(pkg, repoForPackage(pkg, repos), listing.url))
      : filtered.map((repo) => renderPackage({ name: repoName(repo) }, repo, listing.url));

    $('packagesList').replaceChildren(...newCards);
  });
}

loadListing()
  .then((listing) => {
    const title = displayTitle(listing.name);
    const name = authorName(listing.author);
    const url = authorUrl(listing.author);

    document.title = title;
    $('listingName').textContent = title;
    $('listingUrl').value = listing.url;

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

    $('addRepo').onclick = () => {
      if (listing.url) location.href = `vcc://vpm/addRepo?url=${encodeURIComponent(listing.url)}`;
    };

    $('copyUrl').onclick = () => {
      navigator.clipboard.writeText(listing.url).then(() => showToast('已复制 Listing URL'));
    };

    renderPackages(listing);
  })
  .catch((err) => console.error(err));
