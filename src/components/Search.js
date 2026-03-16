import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from 'sonner';

// Composants enfants optimisés
const UserCard = React.memo(({ user, isFollowing, onFollowToggle, isLoading }) => {
  const [imageError, setImageError] = useState(false);

  const handleFollow = useCallback(async () => {
    if (isLoading) return;
    await onFollowToggle(user.id);
  }, [onFollowToggle, user.id, isLoading]);

  return (
    <div className="user-card" role="listitem">
      <div className="user-card-avatar">
        {user.avatar_url && !imageError ? (
          <img 
            src={user.avatar_url} 
            alt={user.username}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <span className="avatar-fallback">
            {user.username?.[0]?.toUpperCase() || '?'}
          </span>
        )}
        {user.verified && <span className="verified-badge">✓</span>}
      </div>
      
      <div className="user-card-info">
        <div className="user-card-header">
          <span className="username">{user.username}</span>
          {user.is_online && <span className="online-indicator" title="En ligne" />}
        </div>
        <p className="bio">{user.bio || 'Aucune bio'}</p>
        <div className="user-stats">
          <span>{user.followers_count || 0} abonnés</span>
          <span>•</span>
          <span>{user.following_count || 0} abonnements</span>
        </div>
      </div>

      <button
        className={`btn-follow ${isFollowing ? 'following' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleFollow}
        disabled={isLoading}
        aria-label={isFollowing ? 'Ne plus suivre' : 'Suivre'}
        aria-pressed={isFollowing}
      >
        {isLoading ? (
          <span className="spinner" />
        ) : isFollowing ? (
          <>
            <span className="icon">✓</span>
            <span className="text-default">Suivi</span>
            <span className="text-hover">Ne plus suivre</span>
          </>
        ) : (
          <>
            <span className="icon">+</span>
            <span>Suivre</span>
          </>
        )}
      </button>
    </div>
  );
});

const SearchSkeleton = () => (
  <div className="user-card skeleton">
    <div className="skeleton-avatar" />
    <div className="skeleton-content">
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
    <div className="skeleton-button" />
  </div>
);

const EmptyState = ({ query, hasError }) => (
  <div className="search-empty-state">
    <div className="empty-icon">{hasError ? '⚠️' : '🔍'}</div>
    <h3>{hasError ? 'Une erreur est survenue' : 'Aucun résultat'}</h3>
    <p>
      {hasError 
        ? 'Veuillez réessayer dans un moment'
        : query 
          ? `Aucun utilisateur trouvé pour "${query}"`
          : 'Commencez à taper pour rechercher des utilisateurs'
      }
    </p>
  </div>
);

// Hook personnalisé pour la recherche
const useUserSearch = (userId) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  // Charger la liste des follows au montage
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (error) throw error;
        setFollowing(new Set(data?.map(f => f.following_id) || []));
      } catch (err) {
        console.error('Erreur chargement follows:', err);
      }
    };

    loadFollowing();
  }, [userId]);

  // Effectuer la recherche
  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      // Annuler la requête précédente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        // Recherche avec RPC pour meilleures perfs ou requête classique
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            username,
            bio,
            avatar_url,
            verified,
            is_online,
            followers_count:follows!following_id(count),
            following_count:follows!follower_id(count)
          `)
          .ilike('username', `%${debouncedQuery}%`)
          .neq('id', userId)
          .limit(20)
          .abortSignal(abortControllerRef.current.signal);

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Erreur recherche:', err);
          setError(err);
          toast.error('Erreur lors de la recherche');
        }
      } finally {
        setLoading(false);
      }
    };

    searchUsers();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedQuery, userId]);

  const toggleFollow = useCallback(async (targetId) => {
    const isCurrentlyFollowing = following.has(targetId);
    
    // Optimistic update
    setFollowing(prev => {
      const next = new Set(prev);
      if (isCurrentlyFollowing) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });

    // Mise à jour du compteur local
    setResults(prev => prev.map(u => {
      if (u.id === targetId) {
        return {
          ...u,
          followers_count: (u.followers_count || 0) + (isCurrentlyFollowing ? -1 : 1)
        };
      }
      return u;
    }));

    try {
      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', targetId);

        if (error) throw error;
        
        toast.success('Vous ne suivez plus cet utilisateur');
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: userId,
            following_id: targetId,
            created_at: new Date().toISOString()
          });

        if (error) {
          // Gérer le cas où l'utilisateur suit déjà (contrainte unique)
          if (error.code === '23505') {
            toast.info('Vous suivez déjà cet utilisateur');
            return;
          }
          throw error;
        }

        // Créer la notification
        await supabase.from('notifications').insert({
          user_id: targetId,
          from_id: userId,
          type: 'follow',
          message: 'a commencé à vous suivre',
          read: false,
          created_at: new Date().toISOString()
        });

        toast.success(`Vous suivez maintenant cet utilisateur`);
      }
    } catch (err) {
      console.error('Erreur follow/unfollow:', err);
      
      // Rollback en cas d'erreur
      setFollowing(prev => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) {
          next.add(targetId);
        } else {
          next.delete(targetId);
        }
        return next;
      });

      setResults(prev => prev.map(u => {
        if (u.id === targetId) {
          return {
            ...u,
            followers_count: (u.followers_count || 0) + (isCurrentlyFollowing ? 1 : -1)
          };
        }
        return u;
      }));

      toast.error('Une erreur est survenue');
    }
  }, [following, userId]);

  return {
    query,
    setQuery,
    results,
    following,
    loading,
    error,
    toggleFollow
  };
};

// Composant principal
function Search({ user }) {
  const {
    query,
    setQuery,
    results,
    following,
    loading,
    error,
    toggleFollow
  } = useUserSearch(user.id);

  const [loadingFollowId, setLoadingFollowId] = useState(null);
  const inputRef = useRef(null);

  // Focus automatique au montage
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFollowWithLoading = useCallback(async (targetId) => {
    setLoadingFollowId(targetId);
    await toggleFollow(targetId);
    setLoadingFollowId(null);
  }, [toggleFollow]);

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, [setQuery]);

  const showResults = query.trim().length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="search-container">
      <div className="search-header">
        <h1>Rechercher</h1>
        <p>Trouvez des utilisateurs à suivre</p>
      </div>

      <div className={`search-input-wrapper ${query ? 'has-value' : ''}`}>
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un utilisateur..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher un utilisateur"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {query && (
          <button 
            className="clear-btn"
            onClick={handleClear}
            aria-label="Effacer la recherche"
            type="button"
          >
            ×
          </button>
        )}
        {loading && <span className="search-spinner" aria-hidden="true" />}
      </div>

      <div className="search-results" role="list" aria-label="Résultats de recherche">
        {showResults && !loading && !hasResults && (
          <EmptyState query={query} hasError={!!error} />
        )}

        {loading && !hasResults && (
          <>
            <SearchSkeleton />
            <SearchSkeleton />
            <SearchSkeleton />
          </>
        )}

        {results.map(u => (
          <UserCard
            key={u.id}
            user={u}
            isFollowing={following.has(u.id)}
            onFollowToggle={handleFollowWithLoading}
            isLoading={loadingFollowId === u.id}
          />
        ))}
      </div>

      {!showResults && (
        <div className="search-suggestions">
          <h3>Suggestions</h3>
          <p>Les utilisateurs populaires apparaîtront ici</p>
        </div>
      )}
    </div>
  );
}

export default React.memo(Search);