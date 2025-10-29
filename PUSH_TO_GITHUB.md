# How to Push SyncPlay Branch to GitHub

## Current Status

The SyncPlay branch has been created locally with all commits, but needs to be pushed to your GitHub fork.

## Steps to Push to GitHub

### 1. Fork the Repository on GitHub

1. Go to https://github.com/jellyfin/jellyfin-web
2. Click the "Fork" button in the top right
3. This will create a fork at `https://github.com/freedbygrace/jellyfin-web`

### 2. Update the Remote

Once you've forked the repository, update the remote:

```bash
cd c:/Users/Support/Github/Jellyfin/jellyfin/jellyfin-web

# Remove the incorrect fork remote if it exists
git remote remove fork

# Add your actual fork as a remote
git remote add fork https://github.com/freedbygrace/jellyfin-web.git

# Verify remotes
git remote -v
```

You should see:
```
fork    https://github.com/freedbygrace/jellyfin-web.git (fetch)
fork    https://github.com/freedbygrace/jellyfin-web.git (push)
origin  https://github.com/jellyfin/jellyfin-web.git (fetch)
origin  https://github.com/jellyfin/jellyfin-web.git (push)
```

### 3. Push the SyncPlay Branch

```bash
# Push the SyncPlay branch to your fork
git push fork SyncPlay

# Or if you want to set it as the upstream branch
git push -u fork SyncPlay
```

### 4. Verify on GitHub

1. Go to `https://github.com/freedbygrace/jellyfin-web`
2. You should see a banner saying "SyncPlay had recent pushes"
3. Click "Compare & pull request" if you want to create a PR

## Current Commits on SyncPlay Branch

```
30c3a43eb - SyncPlay: Add comprehensive UI enhancement recommendations
159b37067 - SyncPlay: Add integration example documentation
2b376e28c - SyncPlay Phase 4: Integration with existing SyncPlay plugin
ea2488e53 - SyncPlay Phase 3: Add lobby screen and main container
508234730 - SyncPlay Phase 2: Add WebSocket handler and chat components
fd8982568 - SyncPlay Phase 1: Add TypeScript types and API utilities
4fa8548b1 - SyncPlay: Add comprehensive documentation
```

## Alternative: Push to a Different Remote

If you want to push to a different location:

```bash
# Add a different remote (e.g., your own server)
git remote add myremote https://github.com/yourusername/jellyfin-web.git

# Push to that remote
git push myremote SyncPlay
```

## Troubleshooting

### "Permission denied" error
- Make sure you've forked the repository first
- Make sure you're pushing to your fork, not the upstream repository
- Check your GitHub authentication (SSH keys or personal access token)

### "Repository not found" error
- The fork doesn't exist yet - create it on GitHub first
- The remote URL is incorrect - verify with `git remote -v`

### Authentication Issues

If you're using HTTPS and need to authenticate:

```bash
# Use GitHub CLI to authenticate
gh auth login

# Or use a personal access token
# When prompted for password, use your personal access token instead
```

Or switch to SSH:

```bash
# Change the remote to use SSH
git remote set-url fork git@github.com:freedbygrace/jellyfin-web.git
```

## After Pushing

Once pushed, you can:

1. **Create a Pull Request** to the upstream repository
2. **Share the branch** with collaborators
3. **Continue development** and push updates with `git push fork SyncPlay`

## Summary

**Quick Commands**:
```bash
# 1. Fork on GitHub first!
# 2. Then run:
cd c:/Users/Support/Github/Jellyfin/jellyfin/jellyfin-web
git remote add fork https://github.com/freedbygrace/jellyfin-web.git
git push -u fork SyncPlay
```

That's it! Your SyncPlay branch will be on GitHub.

