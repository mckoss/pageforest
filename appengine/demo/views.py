from django import forms


class DemoForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput(attrs={'class': 'focus'}))
    value = forms.CharField()


def data(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'demo/data.html', locals())


def jsonp(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'demo/jsonp.html', locals())
