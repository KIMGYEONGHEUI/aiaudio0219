import { useState, useEffect, useRef, MouseEvent, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Type as TypeIcon, 
  Image as ImageIcon, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  BookOpen, 
  Loader2, 
  ChevronRight,
  Volume2,
  Download,
  Share2,
  X,
  User as UserIcon,
  LogOut,
  Settings,
  Heart
} from 'lucide-react';
import { Project, InputMode, GenerationState, User } from './types';
import { generateStory, generateAudio } from './services/gemini';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [genre, setGenre] = useState('Fantasy');
  const [genState, setGenState] = useState<GenerationState>({
    step: 'idle',
    progress: 0,
    message: ''
  });

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setGenre(data.user.favorite_genre);
        fetchProjects();
      }
    } catch (err) {
      console.error('Auth check failed', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setGenre(data.user.favorite_genre);
        fetchProjects();
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Connection failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setProjects([]);
    setActiveProject(null);
  };

  const updatePreferences = async (newGenre: string, newVoice: string) => {
    if (!user) return;
    try {
      await fetch('/api/auth/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite_genre: newGenre, favorite_voice: newVoice })
      });
      setUser({ ...user, favorite_genre: newGenre, favorite_voice: newVoice });
    } catch (err) {
      console.error('Failed to update preferences', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const handleCreate = async () => {
    if (inputMode === 'text' && !inputText) return;
    if (inputMode === 'image' && !imagePreview) return;

    setGenState({ step: 'analyzing', progress: 20, message: 'Analyzing input...' });
    
    try {
      // 1. Generate Story
      setGenState({ step: 'writing', progress: 40, message: 'Crafting your story...' });
      const story = await generateStory(
        inputMode === 'image' ? imagePreview! : inputText,
        inputMode,
        genre
      );

      // 2. Generate Audio
      setGenState({ step: 'synthesizing', progress: 70, message: 'Synthesizing voice...' });
      const audioBase64 = await generateAudio(story.content, user?.favorite_voice || 'Kore');

      if (!audioBase64) throw new Error('Failed to generate audio');

      const newProject: Project = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        title: story.title,
        content: story.content,
        audio_data: audioBase64,
        image_data: imagePreview || undefined,
        genre,
        created_at: new Date().toISOString()
      };

      // 3. Save to DB
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });

      setProjects([newProject, ...projects]);
      setGenState({ step: 'complete', progress: 100, message: 'Audiobook ready!' });
      setActiveProject(newProject);
      setIsCreating(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setGenState({ step: 'error', progress: 0, message: 'Something went wrong. Please try again.' });
    }
  };

  const resetForm = () => {
    setInputText('');
    setImagePreview(null);
    setGenState({ step: 'idle', progress: 0, message: '' });
  };

  const deleteProject = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== id));
      if (activeProject?.id === id) setActiveProject(null);
    } catch (err) {
      console.error(err);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-serif font-bold">VoxStory</h1>
            <p className="text-neutral-500 mt-2">AI Audiobook Generator</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-xs font-mono uppercase text-neutral-500 mb-2 block">Email</label>
              <input 
                type="email" 
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-indigo-500/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-neutral-500 mb-2 block">Password</label>
              <input 
                type="password" 
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-indigo-500/50 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button 
              type="submit"
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              {authMode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r border-white/10 flex flex-col bg-neutral-900/50">
        <div className="p-6 border-bottom border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-serif text-xl font-bold tracking-tight">VoxStory</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <UserIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500 px-2 mb-4">Your Library</h2>
          {projects.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm italic">
              No stories yet. Start creating!
            </div>
          ) : (
            projects.map(project => (
              <motion.div
                layout
                key={project.id}
                onClick={() => setActiveProject(project)}
                className={`group p-3 rounded-xl cursor-pointer transition-all ${
                  activeProject?.id === project.id 
                    ? 'bg-indigo-500/10 border border-indigo-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-sm line-clamp-1">{project.title}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{project.genre} • {new Date(project.created_at).toLocaleDateString()}</p>
                  </div>
                  <button 
                    onClick={(e) => deleteProject(project.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-neutral-400 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col bg-neutral-950">
        <AnimatePresence mode="wait">
          {isProfileOpen ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 z-20 bg-neutral-950 p-8 md:p-12 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                  <h2 className="text-3xl font-serif font-bold">User Profile</h2>
                  <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-12">
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <UserIcon className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">{user.email}</h3>
                        <p className="text-neutral-500 text-sm">Member since {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Heart className="w-5 h-5" />
                      <h3 className="font-mono uppercase tracking-widest text-sm">Preferences</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-mono text-neutral-500 uppercase">Favorite Genre</label>
                        <select 
                          value={user.favorite_genre}
                          onChange={(e) => updatePreferences(e.target.value, user.favorite_voice)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none"
                        >
                          {['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Romance', 'Adventure', 'Children', 'Healing'].map(g => (
                            <option key={g} value={g} className="bg-neutral-900">{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-mono text-neutral-500 uppercase">Preferred Voice</label>
                        <select 
                          value={user.favorite_voice}
                          onChange={(e) => updatePreferences(user.favorite_genre, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none"
                        >
                          {['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].map(v => (
                            <option key={v} value={v} className="bg-neutral-900">{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Settings className="w-5 h-5" />
                      <h3 className="font-mono uppercase tracking-widest text-sm">Account Settings</h3>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-sm text-neutral-400 mb-4">Your account is currently on the Free Plan. Upgrade for unlimited generations and custom voices.</p>
                      <button className="px-6 py-2 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 transition-transform">Upgrade Now</button>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          ) : isCreating ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-neutral-950/90 backdrop-blur-sm"
            >
              <div className="w-full max-w-2xl glass rounded-3xl p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-serif font-bold">Create New Audiobook</h2>
                  <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {genState.step === 'idle' ? (
                  <div className="space-y-6">
                    <div className="flex gap-4 p-1 bg-white/5 rounded-2xl">
                      {(['text', 'image'] as InputMode[]).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setInputMode(mode)}
                          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                            inputMode === mode ? 'bg-white/10 shadow-lg' : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {mode === 'text' ? <TypeIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          <span className="capitalize font-medium">{mode}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {inputMode === 'text' ? (
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="What's your story about? (e.g., A lonely robot discovering a flower on Mars)"
                          className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                        />
                      ) : (
                        <div className="relative h-48 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center overflow-hidden group">
                          {imagePreview ? (
                            <>
                              <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-full text-sm font-bold">Change Image</label>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors">
                              <ImageIcon className="w-10 h-10" />
                              <span className="text-sm font-medium">Upload an image to inspire the story</span>
                            </label>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                      )}

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-mono uppercase text-neutral-500 mb-2 block">Genre</label>
                          <select 
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none"
                          >
                            {['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Romance', 'Adventure', 'Children', 'Healing'].map(g => (
                              <option key={g} value={g} className="bg-neutral-900">{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCreate}
                      disabled={inputMode === 'text' ? !inputText : !imagePreview}
                      className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      Generate Audiobook
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center text-center space-y-6">
                    {genState.step === 'error' ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                          <X className="w-8 h-8" />
                        </div>
                        <p className="text-red-400">{genState.message}</p>
                        <button onClick={() => setGenState({ step: 'idle', progress: 0, message: '' })} className="text-sm underline">Try Again</button>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                            {genState.progress}%
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-serif italic">{genState.message}</h3>
                          <p className="text-sm text-neutral-500">Our AI is weaving your story together...</p>
                        </div>
                        <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${genState.progress}%` }}
                            className="h-full bg-indigo-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeProject ? (
            <motion.div 
              key={activeProject.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
              {/* Header / Cover */}
              <div className="h-64 relative overflow-hidden">
                <img 
                  src={activeProject.image_data || `https://picsum.photos/seed/${activeProject.id}/1200/400?blur=5`} 
                  className="w-full h-full object-cover opacity-30"
                  alt="Cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold uppercase tracking-widest mb-4 inline-block">
                    {activeProject.genre}
                  </span>
                  <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">{activeProject.title}</h2>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-8 py-12">
                <div className="max-w-3xl mx-auto">
                  <div className="prose prose-invert prose-neutral max-w-none">
                    <p className="text-lg leading-relaxed text-neutral-300 font-serif italic first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left">
                      {activeProject.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Player Bar */}
              <div className="h-24 glass border-t border-white/10 px-8 flex items-center justify-between">
                <div className="flex items-center gap-4 w-1/3">
                  <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                  </button>
                  <div>
                    <h4 className="font-medium text-sm line-clamp-1">{activeProject.title}</h4>
                    <p className="text-xs text-neutral-500">AI Narrator</p>
                  </div>
                </div>

                <div className="flex-1 max-w-xl px-8 flex items-center gap-4">
                  <span className="text-xs font-mono text-neutral-500">0:00</span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full w-1/3" />
                    <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs font-mono text-neutral-500">--:--</span>
                </div>

                <div className="flex items-center gap-4 w-1/3 justify-end">
                  <Volume2 className="w-5 h-5 text-neutral-500" />
                  <div className="w-24 h-1 bg-white/10 rounded-full">
                    <div className="w-2/3 h-full bg-white/40 rounded-full" />
                  </div>
                  <div className="h-8 w-px bg-white/10 mx-2" />
                  <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-400 hover:text-white">
                    <Download className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-400 hover:text-white">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                <audio 
                  ref={audioRef}
                  src={`data:audio/mp3;base64,${activeProject.audio_data}`}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mb-8">
                <BookOpen className="w-12 h-12 text-neutral-500" />
              </div>
              <h2 className="text-3xl font-serif font-bold mb-4">Welcome to VoxStory</h2>
              <p className="text-neutral-500 max-w-md mb-8">
                Transform your ideas, memories, and photos into immersive audiobooks narrated by AI.
              </p>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-8 py-4 bg-white text-black rounded-2xl font-bold hover:scale-105 transition-transform flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Your First Story
              </button>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
