# How to Commit and Push Changes

To send the changes made to the remote repository, follow the steps below:

## Prerequisites

1. Have Git installed on your computer
   - If not installed, download from: https://git-scm.com/downloads
   - During installation, select the option to add Git to PATH

## Steps for Commit and Push

1. **Open a Git Bash, PowerShell or CMD terminal**

2. **Navigate to the project folder**
   ```
   cd "C:\Users\GPOLL\OneDrive\Documentos\GitHub\backend-hackathon"
   ```

3. **Check the status of changes**
   ```
   git status
   ```
   This command will show all modified, added or removed files.

4. **Add all changes to stage**
   ```
   git add .
   ```
   Or to add specific files:
   ```
   git add filename
   ```

5. **Commit the changes**
   ```
   git commit -m "Project cleanup for commit and push"
   ```
   Replace the message in quotes with a clear description of the changes made.

6. **Send changes to remote repository**
   ```
   git push origin main
   ```
   If using another branch, replace "main" with your branch name.

## Summary of Changes Made

The main changes that were made to this project are:

- **Translation to English**: All Portuguese content has been translated to English
  - Code comments and error messages
  - Documentation files (README.md, SMART_CONTRACT.md)
  - API response messages
  - Swagger documentation descriptions

- **File Organization**: 
  - Created English versions of documentation files
  - Removed original Portuguese files
  - Updated .gitignore comments

- **Code Consistency**: 
  - Standardized all user-facing messages in English
  - Maintained code functionality while improving readability
  - Updated test files with English messages

## Troubleshooting

### Common Issues

1. **Authentication Error**
   - Make sure you're logged into your GitHub account
   - Use personal access token if required

2. **Permission Denied**
   - Check if you have write access to the repository
   - Verify your SSH keys are configured correctly

3. **Merge Conflicts**
   - Pull latest changes first: `git pull origin main`
   - Resolve conflicts manually
   - Commit resolved changes

4. **Large File Warning**
   - Check if any files exceed GitHub's size limits
   - Use Git LFS for large files if needed

## Best Practices

1. **Commit Messages**
   - Use clear, descriptive messages
   - Start with a verb (Add, Fix, Update, Remove)
   - Keep the first line under 50 characters

2. **Frequent Commits**
   - Make small, logical commits
   - Don't wait to commit large changes
   - Each commit should represent a complete feature or fix

3. **Before Pushing**
   - Test your changes locally
   - Run any available tests
   - Check that the application still works

## Additional Commands

- **View commit history**: `git log --oneline`
- **Undo last commit**: `git reset --soft HEAD~1`
- **Check differences**: `git diff`
- **Create new branch**: `git checkout -b branch-name`
- **Switch branches**: `git checkout branch-name`

## Support

If you encounter any issues:
1. Check the Git documentation: https://git-scm.com/doc
2. Review GitHub's help documentation
3. Ensure all prerequisites are met
4. Verify network connectivity