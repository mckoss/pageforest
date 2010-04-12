from django.shortcuts import redirect

from utils.shortcuts import render_to_response

from auth.forms import RegistrationForm


def register(request):
    """Create a user account on PageForest."""
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('/auth/welcome/')
    else:
        form = RegistrationForm()
    return render_to_response(request, 'auth/register.html', locals())


def login(request):
    """View function placeholder."""
    pass


def logout(request):
    """View function placeholder."""
    pass
