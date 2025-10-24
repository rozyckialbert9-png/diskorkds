// API Configuration
const API_BASE = '/.netlify/functions';

// State
let currentUser = null;
let userData = null;
let servers = [];
let friends = [];
let activeChatUser = null;
let activeServer = null;
let activeChannel = null;
let pendingChannelType = null;

// API Calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Konwersja pliku do Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Sprawdzenie czy użytkownik jest specjalny
function isSpecialUser(username) {
  return username === 'alb3rt2445';
}

// Funkcja do tworzenia chatId dla DM
function getChatId(user1, user2) {
  return [user1, user2].sort().join('_');
}

// Rejestracja
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  if (!username || !password) {
    alert('Wypełnij wszystkie pola!');
    return;
  }

  if (password !== confirmPassword) {
    alert('Hasła nie są identyczne!');
    return;
  }

  try {
    await apiCall('auth', 'POST', {
      action: 'register',
      username,
      password,
    });

    alert('Konto utworzone! Możesz się teraz zalogować.');
    document.getElementById('registerForm').reset();
    showLogin();
  } catch (error) {
    alert(error.message);
  }
});

// Logowanie
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    alert('Wypełnij wszystkie pola!');
    return;
  }

  try {
    const response = await apiCall('auth', 'POST', {
      action: 'login',
      username,
      password,
    });

    currentUser = username;
    userData = response.user;
    localStorage.setItem('discord_current_user', username);
    
    await loadUserData();
    showApp();
  } catch (error) {
    alert(error.message);
  }
});

// Wylogowanie
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Czy na pewno chcesz się wylogować?')) {
    currentUser = null;
    userData = null;
    localStorage.removeItem('discord_current_user');
    activeChatUser = null;
    activeServer = null;
    activeChannel = null;
    showLogin();
  }
});

// Ładowanie danych użytkownika
async function loadUserData() {
  try {
    // Pobierz dane użytkownika
    userData = await apiCall(`users?username=${currentUser}`);
    
    // Pobierz znajomych
    const friendsData = await apiCall('users', 'POST', {
      action: 'get_friends',
      username: currentUser,
    });
    friends = friendsData;
    
    // Pobierz serwery
    servers = await apiCall(`servers?username=${currentUser}`);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Przełączanie ekranów
function showLogin() {
  document.getElementById('loginScreen').classList.add('active');
  document.getElementById('registerScreen').classList.remove('active');
  document.getElementById('appScreen').classList.remove('active');
}

function showRegister() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('registerScreen').classList.add('active');
  document.getElementById('appScreen').classList.remove('active');
}

async function showApp() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('registerScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  
  updateUserPanel();
  updateServersList();
  updateFriendsList();
  showFriendsView();
}

document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  showRegister();
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showLogin();
});

// Aktualizacja panelu użytkownika
function updateUserPanel() {
  document.getElementById('userAvatar').src = userData.avatar;
  
  const usernameEl = document.getElementById('currentUsername');
  if (isSpecialUser(currentUser)) {
    usernameEl.innerHTML = `
      ${currentUser}
      <svg class="crown-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15 8L21 9L16.5 14L18 21L12 17L6 21L7.5 14L3 9L9 8L12 2Z"/>
      </svg>
      <span class="dev-badge">DEV</span>
    `;
    usernameEl.classList.add('special');
  } else {
    usernameEl.textContent = currentUser;
    usernameEl.classList.remove('special');
  }
}

// Aktualizacja listy znajomych w lewym panelu
function updateFriendsList() {
  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '';
  
  friends.forEach(friend => {
    const friendItem = document.createElement('div');
    friendItem.className = 'friend-item';
    if (activeChatUser === friend.username) {
      friendItem.classList.add('active');
    }
    
    friendItem.innerHTML = `
      <img src="${friend.avatar}" alt="${friend.username}" class="avatar">
      <div class="friend-info">
        <div class="friend-name">${friend.username}</div>
        <div class="friend-status">Online</div>
      </div>
    `;
    
    friendItem.addEventListener('click', () => {
      openChat(friend.username);
    });
    
    friendsList.appendChild(friendItem);
  });
}

// Widok znajomych
function showFriendsView() {
  activeServer = null;
  activeChannel = null;
  activeChatUser = null;
  
  document.getElementById('friendsSidebar').classList.add('active');
  document.getElementById('channelsSidebar').classList.remove('active');
  document.getElementById('friendsView').classList.add('active');
  document.getElementById('chatView').classList.remove('active');
  
  updateServersList();
  updateFriendsList();
  updateAllFriendsList();
}

// Aktualizacja wszystkich znajomych w głównym widoku
function updateAllFriendsList() {
  const allFriendsList = document.getElementById('allFriendsList');
  allFriendsList.innerHTML = '';
  
  if (friends.length === 0) {
    allFriendsList.innerHTML = '<p style="color: #b9bbbe; text-align: center; padding: 40px;">Nie masz jeszcze znajomych. Dodaj kogoś!</p>';
    return;
  }
  
  friends.forEach(friend => {
    const card = document.createElement('div');
    card.className = 'friend-card';
    
    const specialClass = isSpecialUser(friend.username) ? 'special' : '';
    const badges = isSpecialUser(friend.username) ? `
      <svg class="crown-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15 8L21 9L16.5 14L18 21L12 17L6 21L7.5 14L3 9L9 8L12 2Z"/>
      </svg>
      <span class="dev-badge">DEV</span>
    ` : '';
    
    card.innerHTML = `
      <div class="friend-card-header">
        <img src="${friend.avatar}" alt="${friend.username}" class="avatar ${specialClass}">
        <div class="friend-card-info">
          <div class="friend-card-name">
            ${friend.username}
            ${badges}
          </div>
          <div class="friend-card-status">${friend.status}</div>
        </div>
      </div>
      <div class="friend-card-actions">
        <button class="btn-message" onclick="openChat('${friend.username}')">Wiadomość</button>
        <button class="btn-profile" onclick="showProfile('${friend.username}')">Profil</button>
      </div>
    `;
    
    allFriendsList.appendChild(card);
  });
}

// Zakładki znajomych
document.querySelectorAll('.friend-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.friend-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.friends-content .tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    if (tabName === 'add') {
      document.getElementById('addFriendTab').classList.add('active');
    } else if (tabName === 'all') {
      document.getElementById('allFriendsTab').classList.add('active');
    }
  });
});

// Dodawanie znajomego
document.getElementById('addFriendBtn').addEventListener('click', () => {
  showFriendsView();
  document.querySelectorAll('.friend-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.friend-tabs .tab[data-tab="add"]').classList.add('active');
  document.querySelectorAll('.friends-content .tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById('addFriendTab').classList.add('active');
});

document.getElementById('sendFriendRequest').addEventListener('click', async () => {
  const friendUsername = document.getElementById('addFriendInput').value.trim();
  
  if (!friendUsername) {
    alert('Wpisz nazwę użytkownika!');
    return;
  }
  
  if (friendUsername === currentUser) {
    alert('Nie możesz dodać siebie do znajomych!');
    return;
  }
  
  try {
    // Sprawdź czy użytkownik istnieje
    await apiCall(`users?username=${friendUsername}`);
    
    // Dodaj do znajomych
    await apiCall('users', 'POST', {
      action: 'add_friend',
      username: currentUser,
      friendUsername,
    });
    
    document.getElementById('addFriendInput').value = '';
    alert(`Dodano ${friendUsername} do znajomych!`);
    
    await loadUserData();
    updateFriendsList();
    updateAllFriendsList();
  } catch (error) {
    alert(error.message);
  }
});

// Otwieranie czatu
async function openChat(friendName) {
  activeChatUser = friendName;
  activeServer = null;
  activeChannel = null;
  
  const friend = friends.find(f => f.username === friendName);
  
  document.getElementById('friendsSidebar').classList.add('active');
  document.getElementById('channelsSidebar').classList.remove('active');
  document.getElementById('friendsView').classList.remove('active');
  document.getElementById('chatView').classList.add('active');
  
  document.getElementById('chatUserAvatar').style.display = 'block';
  document.getElementById('chatUserAvatar').src = friend.avatar;
  document.getElementById('chatUsername').textContent = friendName;
  
  updateServersList();
  updateFriendsList();
  await loadMessages();
}

// Ładowanie wiadomości DM
async function loadMessages() {
  if (!activeChatUser) return;
  
  try {
    const chatId = getChatId(currentUser, activeChatUser);
    const messagesList = await apiCall(`messages?chatId=${chatId}`);
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    for (const msg of messagesList) {
      const author = msg.author === currentUser ? userData : friends.find(f => f.username === msg.author);
      
      const messageEl = document.createElement('div');
      messageEl.className = 'message';
      
      const specialBadges = isSpecialUser(msg.author) ? `
        <svg class="crown-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15 8L21 9L16.5 14L18 21L12 17L6 21L7.5 14L3 9L9 8L12 2Z"/>
        </svg>
        <span class="dev-badge">DEV</span>
      ` : '';
      
      const timestamp = new Date(msg.timestamp);
      
      messageEl.innerHTML = `
        <img src="${author.avatar}" alt="${msg.author}" class="avatar" onclick="showProfile('${msg.author}')">
        <div class="message-content">
          <div class="message-header">
            <span class="message-author" onclick="showProfile('${msg.author}')">${msg.author}</span>
            ${specialBadges}
            <span class="message-timestamp">${timestamp.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="message-text">${msg.content}</div>
        </div>
      `;
      
      container.appendChild(messageEl);
    }
    
    container.scrollTop = container.scrollHeight;
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Wysyłanie wiadomości
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    if (activeChatUser) {
      // DM
      const chatId = getChatId(currentUser, activeChatUser);
      await apiCall('messages', 'POST', {
        chatId,
        author: currentUser,
        content,
      });
      
      input.value = '';
      await loadMessages();
    } else if (activeChannel) {
      // Kanał serwera
      await apiCall('messages', 'POST', {
        serverId: activeServer,
        channelId: activeChannel,
        author: currentUser,
        content,
      });
      
      input.value = '';
      await loadChannelMessages();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Nie udało się wysłać wiadomości');
  }
}

// Przycisk profilu w czacie
document.getElementById('viewProfileBtn').addEventListener('click', () => {
  if (activeChatUser) {
    showProfile(activeChatUser);
  }
});

// Pokazywanie profilu
async function showProfile(username) {
  try {
    const user = username === currentUser ? userData : await apiCall(`users?username=${username}`);
    
    const modal = document.getElementById('profileModal');
    const bannerEl = document.getElementById('profileBanner');
    
    // Ustaw banner
    if (user.banner && user.banner.startsWith('url(')) {
      bannerEl.style.backgroundImage = user.banner;
      bannerEl.style.background = 'none';
    } else {
      bannerEl.style.background = user.banner || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      bannerEl.style.backgroundImage = 'none';
    }
    
    document.getElementById('profileAvatar').src = user.avatar;
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileStatus').textContent = user.status;
    
    if (isSpecialUser(username)) {
      document.getElementById('profileAvatar').classList.add('special');
      document.getElementById('profileBadges').innerHTML = `
        <div class="badge">
          <svg class="crown-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15 8L21 9L16.5 14L18 21L12 17L6 21L7.5 14L3 9L9 8L12 2Z"/>
          </svg>
        </div>
        <div class="badge">
          <span class="dev-badge" style="font-size: 10px; padding: 4px 6px;">DEV</span>
        </div>
      `;
    } else {
      document.getElementById('profileAvatar').classList.remove('special');
      document.getElementById('profileBadges').innerHTML = '';
    }
    
    const actionsContainer = document.getElementById('profileActions');
    if (username !== currentUser) {
      actionsContainer.innerHTML = `
        <button class="btn-primary" onclick="openChat('${username}'); document.getElementById('profileModal').classList.remove('active')">Wyślij wiadomość</button>
      `;
    } else {
      actionsContainer.innerHTML = '';
    }
    
    modal.classList.add('active');
  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Nie udało się załadować profilu');
  }
}

// Ustawienia
document.getElementById('settingsBtn').addEventListener('click', () => {
  const modal = document.getElementById('settingsModal');
  
  document.getElementById('settingsAvatar').src = userData.avatar;
  
  const bannerEl = document.getElementById('settingsBanner');
  if (userData.banner && userData.banner.startsWith('url(')) {
    bannerEl.style.backgroundImage = userData.banner;
    bannerEl.style.background = 'none';
  } else {
    bannerEl.style.background = userData.banner || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    bannerEl.style.backgroundImage = 'none';
  }
  
  document.getElementById('statusInput').value = userData.status;
  document.getElementById('usernameDisplay').value = currentUser;
  
  modal.classList.add('active');
});

// Nawigacja ustawień
document.querySelectorAll('.settings-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const section = btn.dataset.section;
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section + 'Settings').classList.add('active');
  });
});

// Upload avatara
document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
  document.getElementById('avatarUpload').click();
});

document.getElementById('avatarUpload').addEventListener('change', async