import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';

describe('PlaceholdersAndVanishInput', () => {
  it('shows the first placeholder initially', () => {
    render(
      <form>
        <PlaceholdersAndVanishInput
          name='q'
          label='Skill'
          placeholders={['First', 'Second']}
        />
      </form>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('hides the placeholder when the user types', async () => {
    render(
      <form>
        <PlaceholdersAndVanishInput
          name='q'
          label='Skill'
          placeholders={['First', 'Second']}
        />
      </form>
    );
    const placeholder = screen.getByText('First');
    expect(placeholder.parentElement).not.toHaveClass('invisible');
    await userEvent.type(screen.getByLabelText('Skill'), 'x');
    await waitFor(() => {
      expect(placeholder.parentElement).toHaveClass('invisible');
    });
  });

  it('clears the input when the form submits', async () => {
    render(
      <form>
        <PlaceholdersAndVanishInput
          name='q'
          label='Skill'
          placeholders={['First', 'Second']}
        />
      </form>
    );
    const input = screen.getByLabelText('Skill');
    await userEvent.type(input, 'value');
    expect(input).toHaveValue('value');

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
  });
});
